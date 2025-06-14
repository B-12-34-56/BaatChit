const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Twilio client
const twilioClient = twilio(
  functions.config().twilio.account_sid,
  functions.config().twilio.auth_token
);

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone) {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If the number starts with 1, remove it (we'll add it back)
  if (cleaned.startsWith('1')) {
    cleaned = cleaned.substring(1);
  }
  
  // Ensure the number is 10 digits (US format)
  if (cleaned.length !== 10) {
    throw new Error('Phone number must be 10 digits');
  }
  
  // Add +1 prefix for US numbers
  return `+1${cleaned}`;
}

/**
 * Verify Twilio OTP and generate Firebase custom token
 */
exports.verifyPhoneAndCreateToken = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber, code, verificationSid } = data;

    // Validate input
    if (!phoneNumber || !code || !verificationSid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: phoneNumber, code, or verificationSid'
      );
    }

    console.log('Verifying phone:', phoneNumber, 'with sid:', verificationSid);

    // Step 1: Verify the code with Twilio
    const verification = await twilioClient.verify.v2
      .services(functions.config().twilio.verify_service_sid)
      .verificationChecks
      .create({
        to: phoneNumber,
        code: code,
        verificationSid: verificationSid
      });

    console.log('Twilio verification result:', verification.status);

    if (verification.status !== 'approved') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Invalid verification code'
      );
    }

    // Step 2: Generate a proper Firebase-style UID
    const properUid = admin.firestore().collection('users').doc().id;
    console.log('Generated proper UID:', properUid);

    try {
      // Try to get existing user by phone number
      const userRecord = await admin.auth().getUserByPhoneNumber(phoneNumber);
      console.log('Found existing user:', userRecord.uid);
      
      // If user exists, use their existing UID
      const uid = userRecord.uid;
      
      // Update user's storageUid if it doesn't exist
      const userDoc = await admin.firestore().collection('users').doc(uid).get();
      if (!userDoc.exists || !userDoc.data().storageUid) {
        await admin.firestore().collection('users').doc(uid).set({
          storageUid: properUid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user with proper UID
        await admin.auth().createUser({
          uid: properUid,
          phoneNumber: phoneNumber,
          displayName: phoneNumber,
        });
        console.log('Created new user with proper UID:', properUid);
      } else {
        throw error;
      }
    }

    // Step 3: Generate custom token
    try {
      const customToken = await admin.auth().createCustomToken(properUid, {
        phoneNumber: phoneNumber,
        verifiedAt: admin.firestore.Timestamp.now(),
        provider: 'twilio'
      });

      // Step 4: Store user data in Firestore
      await admin.firestore().collection('users').doc(properUid).set({
        phoneNumber: phoneNumber,
        lastLogin: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        authProvider: 'twilio',
        isPhoneVerified: true,
        storageUid: properUid // Store the proper UID
      }, { merge: true });

      console.log('Successfully created custom token for:', phoneNumber);

      return {
        success: true,
        customToken: customToken,
        uid: properUid,
        phoneNumber: phoneNumber
      };
    } catch (error) {
      console.error('Error creating custom token:', error);
      
      // Check if it's a permission error
      if (error.message && error.message.includes('Permission')) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Service account needs the Service Account Token Creator role. Please contact your administrator.'
        );
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'Failed to create authentication token: ' + error.message
      );
    }

  } catch (error) {
    console.error('Error in verifyPhoneAndCreateToken:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to verify phone and create token: ' + error.message
    );
  }
});

/**
 * Initialize phone verification with Twilio
 */
exports.initiatePhoneVerification = functions.https.onCall(async (data, context) => {
  try {
    const { phoneNumber } = data;

    if (!phoneNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number is required'
      );
    }

    // Format phone number to E.164
    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log('Initiating verification for:', formattedPhone);

    // Start verification with Twilio
    const verification = await twilioClient.verify.v2
      .services(functions.config().twilio.verify_service_sid)
      .verifications
      .create({
        to: formattedPhone,
        channel: 'sms'
      });

    console.log('Twilio verification initiated:', verification.sid);

    return {
      success: true,
      verificationSid: verification.sid,
      phoneNumber: formattedPhone,
      status: verification.status
    };

  } catch (error) {
    console.error('Error initiating phone verification:', error);
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to initiate phone verification: ' + error.message
    );
  }
});

/**
 * Migrate existing users to have proper UIDs
 * This function should be called manually from the Firebase Console
 */
exports.migrateUserUids = functions.https.onCall(async (data, context) => {
  try {
    // Only allow admin to run this function
    if (!context.auth?.token?.admin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only administrators can run this function'
      );
    }

    const db = admin.firestore();
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();
    
    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        
        // Skip if user already has a storageUid
        if (userData.storageUid) {
          continue;
        }

        // Generate new proper UID
        const properUid = db.collection('users').doc().id;
        
        // Update user document with new storageUid
        await userDoc.ref.set({
          storageUid: properUid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // If the user has a phone number, try to update their auth record
        if (userData.phoneNumber) {
          try {
            const userRecord = await admin.auth().getUserByPhoneNumber(userData.phoneNumber);
            if (userRecord) {
              // Update custom claims to include storageUid
              await admin.auth().setCustomUserClaims(userRecord.uid, {
                storageUid: properUid
              });
            }
          } catch (authError) {
            console.warn(`Could not update auth record for user ${userDoc.id}:`, authError);
          }
        }

        migratedCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          userId: userDoc.id,
          error: error.message
        });
        console.error(`Error migrating user ${userDoc.id}:`, error);
      }
    }

    return {
      success: true,
      migratedCount,
      errorCount,
      errors
    };

  } catch (error) {
    console.error('Error in migrateUserUids:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to migrate user UIDs: ' + error.message
    );
  }
});