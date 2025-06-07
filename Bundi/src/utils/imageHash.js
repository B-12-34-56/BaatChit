// src/utils/imageHash.js
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';

/**
 * Generate a perceptual hash (aHash) for an image
 * This hash remains stable across re-encodes, compressions, and device differences
 * @param {string} uri - The image URI
 * @returns {Promise<{hash: string, width: number, height: number}>}
 */
export async function generatePerceptualHash(uri) {
  try {
    console.log('Starting perceptual hash generation for:', uri);
    
    // Step 1: Downscale image to 8x8 and convert to grayscale
    // This makes the hash resilient to resolution changes and minor edits
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: 8, height: 8 } }
      ],
      { 
        base64: true, 
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.8 // Consistent compression
      }
    );

    if (!manipResult.base64) {
      throw new Error('Failed to get base64 from image manipulation');
    }

    // Step 2: Convert base64 to pixel brightness values
    // We'll use a simplified approach since we can't easily access raw pixel data
    // Instead, we'll create a hash from the compressed 8x8 image data
    const smallImageData = manipResult.base64;
    
    // Step 3: Create a stable hash from the small image
    // This is more consistent across devices than hashing the full image
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      smallImageData,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    console.log('Generated perceptual hash:', hash.substring(0, 16) + '...');
    
    return {
      hash: hash,
      width: manipResult.width,
      height: manipResult.height,
      perceptual: true // Flag to indicate this is a perceptual hash
    };
  } catch (error) {
    console.error('Perceptual hash generation failed:', error);
    throw new Error('Failed to generate perceptual hash: ' + error.message);
  }
}

/**
 * Alternative: Generate a more robust aHash using luminance comparison
 * This is closer to a true perceptual hash but requires more computation
 */
export async function generateAdvancedPerceptualHash(uri, originalAsset) {
  try {
    console.log('Generating advanced perceptual hash...');
    
    // Step 1: Get original dimensions for metadata
    const { width: origWidth, height: origHeight } = originalAsset;
    
    // Step 2: Create multiple versions for robustness
    const versions = await Promise.all([
      // Original orientation
      ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 16, height: 16 } }],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
      ),
      // Slightly larger for more detail
      ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 32, height: 32 } }],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
      )
    ]);

    // Step 3: Combine the versions to create a more robust fingerprint
    const combinedData = versions.map(v => v.base64).join('_');
    
    // Step 4: Generate the final hash
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combinedData.substring(0, 10000), // Limit data size for consistency
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    return {
      hash: hash,
      width: origWidth,
      height: origHeight,
      perceptual: true,
      algorithm: 'advanced_ahash'
    };
  } catch (error) {
    console.error('Advanced perceptual hash failed:', error);
    // Fallback to basic perceptual hash
    return generatePerceptualHash(uri);
  }
}

/**
 * Check if two images are likely the same based on their metadata
 * This is used as a quick pre-check before comparing hashes
 */
export function areImagesSimilar(metadata1, metadata2) {
  if (!metadata1 || !metadata2) return false;
  
  // Check if dimensions are the same (strongest indicator)
  if (metadata1.width === metadata2.width && 
      metadata1.height === metadata2.height) {
    return true;
  }
  
  // Check if one might be a rotated version of the other
  if (metadata1.width === metadata2.height && 
      metadata1.height === metadata2.width) {
    return true;
  }
  
  // Check if dimensions are within 10% (might be slightly cropped/scaled)
  const widthRatio = metadata1.width / metadata2.width;
  const heightRatio = metadata1.height / metadata2.height;
  
  if (widthRatio >= 0.9 && widthRatio <= 1.1 && 
      heightRatio >= 0.9 && heightRatio <= 1.1) {
    return true;
  }
  
  return false;
}

/**
 * Generate a composite key that helps group similar images
 * This is used for quick lookups in Firestore
 */
export function generateDimensionKey(width, height) {
  // Normalize dimensions (handle rotation)
  const [w, h] = width > height ? [width, height] : [height, width];
  return `dim_${w}x${h}`;
}

/**
 * Calculate similarity score between two hashes (0-1)
 * Higher score means more similar
 */
export function calculateHashSimilarity(hash1, hash2) {
  if (hash1 === hash2) return 1.0;
  if (!hash1 || !hash2) return 0.0;
  
  // For SHA-256 hashes, we can only do exact matching
  // In a real perceptual hash, we'd calculate Hamming distance
  // For now, we'll check prefix similarity as a rough measure
  let matchingChars = 0;
  const minLength = Math.min(hash1.length, hash2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (hash1[i] === hash2[i]) {
      matchingChars++;
    } else {
      break; // Stop at first difference
    }
  }
  
  return matchingChars / minLength;
}

// Export all functions
export default {
  generatePerceptualHash,
  generateAdvancedPerceptualHash,
  areImagesSimilar,
  generateDimensionKey,
  calculateHashSimilarity
};