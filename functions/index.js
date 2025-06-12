// Note: Using v1 syntax for Storage triggers as v2 doesn't support them yet
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { generateRobustHash, compareHashes, areSimilar } = require('./imageHash');
const twilio = require('twilio');

// Debug configuration
const DEBUG = {
  enabled: process.env.DEBUG_MODE === 'true',
  logLevel: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  logThreshold: process.env.LOG_THRESHOLD || 30, // Threshold for logging similarity comparisons
  logDetails: process.env.LOG_DETAILS === 'true' // Whether to log detailed hash information
};

// Enhanced logging function
function log(level, message, data = null) {
  if (!DEBUG.enabled && level === 'debug') return;
  
  const levels = ['debug', 'info', 'warn', 'error'];
  const currentLevel = levels.indexOf(DEBUG.logLevel);
  const messageLevel = levels.indexOf(level);
  
  if (messageLevel >= currentLevel) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      console.log(prefix, message, JSON.stringify(data, null, 2));
    } else {
      console.log(prefix, message);
    }
  }
}

// Initialize Firebase Admin with default credentials
admin.initializeApp();

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Twilio Verify Service SID
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

// Enhanced similarity detection with better thresholds
async function findSimilarImages(db, hashData, fileHash, threshold = 300) {
  const similarImages = [];
  
  try {
    // First, try to find exact matches
    const exactMatches = await db.collection('perceptual_hashes')
      .where('perceptualHash', '==', hashData.perceptualHash)
      .get();
    
    exactMatches.forEach(doc => {
      if (doc.id !== fileHash) {
        similarImages.push({
          originalHash: doc.id,
          distance: 0,
          filePath: doc.data().filePath,
          matchType: 'exact'
        });
      }
    });
    
    // If we found exact matches, return early
    if (similarImages.length > 0) {
      console.log(`Found ${similarImages.length} exact matches`);
      return similarImages;
    }
    
    // Otherwise, do similarity search
    const BATCH_SIZE = 100;
    let lastDoc = null;
    let processedCount = 0;
    
    while (processedCount < 500) { // Limit to prevent timeout
      let query = db.collection('perceptual_hashes');
      
      // For the first batch, don't use ordering to avoid index requirements
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      query = query.limit(BATCH_SIZE);
      
      const snapshot = await query.get();
      
      if (snapshot.empty) break;
      
      for (const doc of snapshot.docs) {
        if (doc.id !== fileHash) {
          const otherHashData = doc.data();
          
          // Compare using robust hash comparison
          const distance = compareHashes(hashData, otherHashData, threshold);
          
          // Log comparison details for debugging
          if (processedCount === 0 || distance <= threshold * 1.5) { // Log first comparison and near-matches
            console.log(`Comparing with ${doc.id}:`, {
              distance,
              threshold,
              isMatch: distance <= threshold,
              ourHash: hashData.perceptualHash?.substring(0, 32),
              theirHash: otherHashData.perceptualHash?.substring(0, 32)
            });
          }
          
          if (distance <= threshold) {
            similarImages.push({
              originalHash: doc.id,
              distance,
              filePath: otherHashData.filePath || otherHashData.path || doc.data().filePath || 'unknown',
              matchType: distance <= 20 ? 'very_similar' : 'similar'
            });
            
            console.log(`✅ Found similar image: ${doc.id} with distance ${distance}`);
          }
        }
      }
      
      processedCount += snapshot.size;
      lastDoc = snapshot.docs[snapshot.size - 1];
      
      // Early termination if we found enough
      if (similarImages.length >= 3) {
        console.log(`Early termination: Found ${similarImages.length} similar images`);
        break;
      }
    }
    
    console.log(`Processed ${processedCount} hashes, found ${similarImages.length} similar images`);
    return similarImages;
    
  } catch (error) {
    console.error('Error in findSimilarImages:', error);
    return similarImages;
  }
}

// Main processing function
exports.processImageUpload = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB' // Increased memory for better processing
  })
  .storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  const bucket = admin.storage().bucket(object.bucket);
  const file = bucket.file(filePath);
  
  console.log('🚀 Function triggered for:', filePath);
  
  // Only process user uploads
  if (!filePath.startsWith('user_uploads/')) {
    console.log('⏭️ Skipping non-user upload');
    return null;
  }
  
  try {
    // Get metadata
    const [metadata] = await file.getMetadata();
    const fileHash = metadata.metadata?.fileHash;
    
    if (!fileHash) {
      console.log('❌ No file hash in metadata');
      return null;
    }
    
    console.log('📝 Processing file with hash:', fileHash);
    
    // Check if already processed
    const existingHash = await admin.firestore()
      .collection('perceptual_hashes')
      .doc(fileHash)
      .get();
    
    if (existingHash.exists) {
      console.log('⚡ Already processed, skipping');
      return null;
    }
    
    // Download image
    console.log('📥 Downloading image...');
    const [buffer] = await file.download();
    console.log(`📊 Image size: ${buffer.length} bytes`);
    
    // Generate robust hash
    console.log('🔍 Generating robust perceptual hash...');
    const hashData = await generateRobustHash(buffer);
    
    console.log('📋 Hash data:', {
      perceptualHash: hashData.perceptualHash?.substring(0, 64) + '...',
      averageHashPreview: hashData.averageHash?.substring(0, 32) + '...',
      dctHashPreview: hashData.dctHash?.substring(0, 32) + '...',
      colorHash: hashData.colorHash,
      contentType: metadata.contentType,
      fileSize: buffer.length
    });
    
    // Store the hash data
    await admin.firestore().collection('perceptual_hashes').doc(fileHash).set({
      fileHash,
      filePath,
      ...hashData,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      imageSize: buffer.length,
      contentType: metadata.contentType
    });
    
    console.log('💾 Stored perceptual hash data');
    
    // Find similar images with adjusted threshold
    const SIMILARITY_THRESHOLD = 300; // High threshold for iMessage compression (30% of 1024-bit hash)
    const similarImages = await findSimilarImages(
      admin.firestore(), 
      hashData, 
      fileHash, 
      SIMILARITY_THRESHOLD
    );
    
    console.log(`🔍 Found ${similarImages.length} similar images`);
    
    // Store similarity data
    if (similarImages.length > 0) {
      const batch = admin.firestore().batch();
      
      // Store for current image
      batch.set(admin.firestore().collection('image_similarities').doc(fileHash), {
        fileHash,
        similarImages,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Update similarity groups
      await updateSimilarityGroups(fileHash, similarImages);
      
      await batch.commit();
      console.log(`✅ Stored similarity data`);
    } else {
      // Create a new group for this unique image
      await admin.firestore().collection('similarity_groups').doc(fileHash).set({
        fileHash,
        groupId: fileHash,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Update group counts
    await updateGlobalSimilarityGroups(fileHash, similarImages);
    
    console.log('🎉 Processing complete!');
    return { success: true, similarCount: similarImages.length };
    
  } catch (error) {
    console.error('💥 Error processing image:', error);
    
    // Store error state - get metadata safely
    let errorFileHash = 'unknown';
    try {
      const [errorMetadata] = await file.getMetadata();
      errorFileHash = errorMetadata.metadata?.fileHash || 'unknown';
    } catch (metaError) {
      console.warn('Could not get metadata for error logging');
    }
    
    await admin.firestore().collection('processing_errors').add({
      fileHash: errorFileHash,
      filePath,
      error: error.message,
      stack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return null;
  }
});

// Update similarity groups with better merging
async function updateSimilarityGroups(fileHash, similarImages) {
  const db = admin.firestore();
  const batch = db.batch();
  
  try {
    // Find all existing groups
    const existingGroups = new Set();
    
    // Check current file's group
    const currentGroup = await db.collection('similarity_groups').doc(fileHash).get();
    if (currentGroup.exists) {
      existingGroups.add(currentGroup.data().groupId);
    }
    
    // Check similar images' groups
    for (const similar of similarImages) {
      const group = await db.collection('similarity_groups').doc(similar.originalHash).get();
      if (group.exists) {
        existingGroups.add(group.data().groupId);
      }
    }
    
    // Determine the group ID (use smallest hash as canonical ID)
    let groupId;
    if (existingGroups.size === 0) {
      groupId = fileHash;
    } else if (existingGroups.size === 1) {
      groupId = Array.from(existingGroups)[0];
    } else {
      // Merge groups - use the smallest hash as the new group ID
      const allHashes = [fileHash, ...similarImages.map(s => s.originalHash)];
      groupId = allHashes.sort()[0];
      
      log('debug', `🔀 Merging ${existingGroups.size} groups into ${groupId}`);
    }
    
    // Update all members to the same group
    batch.set(db.collection('similarity_groups').doc(fileHash), {
      fileHash,
      groupId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    for (const similar of similarImages) {
      batch.set(db.collection('similarity_groups').doc(similar.originalHash), {
        fileHash: similar.originalHash,
        groupId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    
    await batch.commit();
    log('info', `📁 Updated similarity group: ${groupId}`);
    
  } catch (error) {
    log('error', 'Error updating similarity groups:', { error: error.message, stack: error.stack });
  }
}

// Enhanced global similarity group management
async function updateGlobalSimilarityGroups(fileHash, similarImages) {
  const db = admin.firestore();
  
  log('info', '🔗 Updating global similarity groups...');
  
  try {
    // Get the group for this file
    const groupDoc = await db.collection('similarity_groups').doc(fileHash).get();
    if (!groupDoc.exists) {
      log('warn', '❌ No group found for file');
      return;
    }
    
    const groupId = groupDoc.data().groupId;
    
    // Update group total count
    await updateGroupTotalCount(groupId);
    
  } catch (error) {
    log('error', 'Error in updateGlobalSimilarityGroups:', { error: error.message, stack: error.stack });
  }
}

// Calculate total count for a similarity group
async function updateGroupTotalCount(groupId) {
  const db = admin.firestore();
  
  log('info', '📊 Updating group count for:', groupId);
  
  try {
    // Get all members of the group
    const groupMembers = await db.collection('similarity_groups')
      .where('groupId', '==', groupId)
      .get();
    
    let totalCount = 0;
    const allUploads = [];
    const memberHashes = [];
    
    // Process each member
    for (const member of groupMembers.docs) {
      const hash = member.id;
      memberHashes.push(hash);
      
      // Get upload log for this hash
      const uploadLog = await db.collection('global_upload_logs').doc(hash).get();
      
      if (uploadLog.exists) {
        const data = uploadLog.data();
        totalCount += data.count || 0;
        
        const uploads = (data.uploads || []).map(u => ({
          ...u,
          imageHash: hash
        }));
        allUploads.push(...uploads);
      }
    }
    
    // Cache the group count
    await db.collection('group_counts').doc(groupId).set({
      groupId,
      totalCount,
      memberCount: groupMembers.size,
      memberHashes,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    log('info', `📈 Group ${groupId}: ${totalCount} uploads across ${groupMembers.size} images`);
    
  } catch (error) {
    log('error', 'Error updating group count:', { error: error.message, stack: error.stack });
  }
}

// Callable function for getting similarity count
exports.getSimilarityGroupCount = functions.https.onCall(async (data, context) => {
  const { fileHash } = data;
  
  if (!fileHash) {
    throw new functions.https.HttpsError('invalid-argument', 'File hash is required');
  }
  
  const db = admin.firestore();
  
  try {
    // Get similarity group
    const groupDoc = await db.collection('similarity_groups').doc(fileHash).get();
    
    if (!groupDoc.exists) {
      // No group means it's unique
      const uploadLog = await db.collection('global_upload_logs').doc(fileHash).get();
      const count = uploadLog.exists ? uploadLog.data().count : 0;
      
      return { 
        totalCount: count, 
        relatedHashes: [fileHash], 
        groupId: null 
      };
    }
    
    const groupId = groupDoc.data().groupId;
    
    // Get cached count
    const groupCount = await db.collection('group_counts').doc(groupId).get();
    
    if (groupCount.exists) {
      const data = groupCount.data();
      return {
        totalCount: data.totalCount,
        relatedHashes: data.memberHashes || [fileHash],
        groupId,
        memberCount: data.memberCount
      };
    }
    
    // Fallback: calculate manually
    await updateGroupTotalCount(groupId);
    
    const retryCount = await db.collection('group_counts').doc(groupId).get();
    const data = retryCount.data() || { totalCount: 0, memberHashes: [fileHash] };
    
    return {
      totalCount: data.totalCount,
      relatedHashes: data.memberHashes || [fileHash],
      groupId,
      memberCount: data.memberCount || 1
    };
    
  } catch (error) {
    log('error', 'Error getting similarity count:', { error: error.message, stack: error.stack });
    throw new functions.https.HttpsError('internal', 'Failed to get count');
  }
});

// Update counts when upload logs change
exports.onUploadLogUpdate = functions.firestore
  .document('global_upload_logs/{fileHash}')
  .onWrite(async (change, context) => {
    const fileHash = context.params.fileHash;
    const db = admin.firestore();
    
    log('info', '📝 Upload log updated for:', fileHash);
    
    try {
      const groupDoc = await db.collection('similarity_groups').doc(fileHash).get();
      
      if (groupDoc.exists) {
        const groupId = groupDoc.data().groupId;
        await updateGroupTotalCount(groupId);
        log('info', '✅ Updated group count');
      }
    } catch (error) {
      log('error', 'Error in onUploadLogUpdate:', { error: error.message, stack: error.stack });
    }
  });

// Health check function
exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

exports.verifyPhoneCode = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber, code } = data;

    if (!phoneNumber || !code) {
      throw new Error("Phone number and verification code are required");
    }

    // Verify the code with Twilio
    const verification = await twilioClient.verify.v2
      .services(VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: phoneNumber,
        code: code,
      });

    if (verification.status !== "approved") {
      throw new Error("Invalid verification code");
    }

    // Create a custom token for the user
    const customToken = await admin.auth().createCustomToken(phoneNumber);

    return {
      success: true,
      customToken: customToken,
    };
  } catch (error) {
    console.error("Error in verifyPhoneCode:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});