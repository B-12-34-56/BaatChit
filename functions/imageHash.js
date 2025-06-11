// functions/imageHash.js
const sharp = require('sharp');
const crypto = require('crypto');

/**
 * Enhanced perceptual hash that's more robust for cross-device detection
 * Uses average hash algorithm with better preprocessing
 */
async function getPerceptualHash(buffer) {
  try {
    // First resize to 32x32 and convert to grayscale
    // Don't use normalize() as it can cause all pixels to become 0 or 255
    const grayscale = await sharp(buffer)
      .resize(32, 32, { 
        fit: 'fill',
        kernel: sharp.kernel.lanczos3
      })
      .grayscale()
      .raw()
      .toBuffer();
    
    const pixels = Array.from(grayscale);
    
    // Check if we have valid pixel data
    if (pixels.length !== 32 * 32) {
      console.error('Invalid pixel data length:', pixels.length);
      throw new Error('Invalid image data');
    }
    
    // Calculate mean
    const sum = pixels.reduce((acc, val) => acc + val, 0);
    const mean = sum / pixels.length;
    
    // Sanity check - if all pixels are the same, the image is probably corrupted
    const uniqueValues = new Set(pixels);
    if (uniqueValues.size < 2) {
      console.warn('Image appears to be uniform color, using fallback hash');
      return {
        averageHash: await generateFallbackHash(buffer),
        dctHash: await generateFallbackHash(buffer),
        combined: await generateFallbackHash(buffer)
      };
    }
    
    // Generate binary hash
    let binaryHash = '';
    for (let i = 0; i < pixels.length; i++) {
      binaryHash += pixels[i] > mean ? '1' : '0';
    }
    
    // Also generate a DCT-based hash for better accuracy
    const dctHash = await getDCTHash(buffer);
    
    // Combine both hashes for better detection
    return {
      averageHash: binaryHash,
      dctHash: dctHash,
      combined: combineHashes(binaryHash, dctHash)
    };
  } catch (error) {
    console.error('Error generating perceptual hash:', error);
    throw error;
  }
}

/**
 * DCT-based hash for better cross-device detection
 */
async function getDCTHash(buffer) {
  try {
    // Resize to 32x32 for DCT
    const resized = await sharp(buffer)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();
    
    const size = 32;
    const pixels = [];
    
    // Convert to 2D array
    for (let y = 0; y < size; y++) {
      pixels[y] = [];
      for (let x = 0; x < size; x++) {
        pixels[y][x] = resized[y * size + x];
      }
    }
    
    // Simple DCT implementation (taking top-left 8x8 coefficients)
    const dct = simpleDCT(pixels, 8);
    
    // Flatten and calculate median (excluding DC coefficient)
    const flattened = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (x !== 0 || y !== 0) { // Skip DC coefficient
          flattened.push(dct[y][x]);
        }
      }
    }
    
    // If no valid DCT coefficients, use fallback
    if (flattened.length === 0) {
      return await generateFallbackHash(buffer);
    }
    
    const sorted = [...flattened].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Generate hash
    let hash = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (x !== 0 || y !== 0) {
          hash += dct[y][x] > median ? '1' : '0';
        }
      }
    }
    
    return hash;
  } catch (error) {
    console.error('Error generating DCT hash:', error);
    // Fallback to simple hash
    return await generateFallbackHash(buffer);
  }
}

/**
 * Simple DCT implementation for perceptual hashing
 */
function simpleDCT(pixels, size) {
  const result = [];
  const N = pixels.length;
  
  for (let v = 0; v < size; v++) {
    result[v] = [];
    for (let u = 0; u < size; u++) {
      let sum = 0;
      
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          sum += pixels[y][x] * 
                 Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
                 Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
        }
      }
      
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      
      result[v][u] = (2 / N) * cu * cv * sum;
    }
  }
  
  return result;
}

/**
 * Combine multiple hashes for better detection
 */
function combineHashes(hash1, hash2) {
  // Use first 128 bits of hash1 and first 128 bits of hash2
  const combined = hash1.substring(0, 128) + hash2.substring(0, 128);
  return combined;
}

/**
 * Generate a more robust perceptual hash using multiple techniques
 */
async function generateRobustHash(buffer) {
  try {
    // Get multiple hash types
    const hashes = await getPerceptualHash(buffer);
    
    // Also get color histogram for additional matching
    const colorHash = await getColorHash(buffer);
    
    return {
      perceptualHash: hashes.combined,
      averageHash: hashes.averageHash,
      dctHash: hashes.dctHash,
      colorHash: colorHash
    };
  } catch (error) {
    console.error('Error generating robust hash:', error);
    return {
      perceptualHash: await generateFallbackHash(buffer),
      averageHash: null,
      dctHash: null,
      colorHash: null
    };
  }
}

/**
 * Color histogram hash for detecting color-shifted duplicates
 */
async function getColorHash(buffer) {
  try {
    const { data, info } = await sharp(buffer)
      .resize(64, 64, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Simple color histogram (8 bins per channel)
    const bins = 8;
    const histogram = {
      r: new Array(bins).fill(0),
      g: new Array(bins).fill(0),
      b: new Array(bins).fill(0)
    };
    
    // Only process if we have RGB data
    if (info.channels >= 3) {
      for (let i = 0; i < data.length; i += info.channels) {
        const r = Math.floor(data[i] / (256 / bins));
        const g = Math.floor(data[i + 1] / (256 / bins));
        const b = Math.floor(data[i + 2] / (256 / bins));
        
        histogram.r[Math.min(r, bins - 1)]++;
        histogram.g[Math.min(g, bins - 1)]++;
        histogram.b[Math.min(b, bins - 1)]++;
      }
    }
    
    // Normalize and create hash
    const total = data.length / info.channels;
    let hash = '';
    
    ['r', 'g', 'b'].forEach(channel => {
      histogram[channel].forEach(count => {
        const normalized = Math.floor((count / total) * 15);
        hash += normalized.toString(16);
      });
    });
    
    return hash;
  } catch (error) {
    console.error('Error generating color hash:', error);
    return '';
  }
}

/**
 * Enhanced similarity comparison that uses multiple hash types
 */
function compareHashes(hash1, hash2, threshold = 15) {
  if (!hash1 || !hash2) return 999;
  
  // Handle both string hashes and object hashes
  if (typeof hash1 === 'string' && typeof hash2 === 'string') {
    return hammingDistance(hash1, hash2);
  }
  
  // If we have robust hashes with multiple components
  if (hash1.perceptualHash && hash2.perceptualHash) {
    const perceptualDist = hammingDistance(hash1.perceptualHash, hash2.perceptualHash);
    
    // Check if color histograms are similar
    let colorSimilarity = 1;
    if (hash1.colorHash && hash2.colorHash) {
      colorSimilarity = compareColorHashes(hash1.colorHash, hash2.colorHash);
    }
    
    // Weight the different factors
    return perceptualDist * colorSimilarity;
  }
  
  return 999;
}

/**
 * Calculate Hamming distance between two binary strings
 */
function hammingDistance(str1, str2) {
  if (!str1 || !str2) return 999;
  
  const len = Math.min(str1.length, str2.length);
  let distance = Math.abs(str1.length - str2.length) * 2; // Penalty for length difference
  
  for (let i = 0; i < len; i++) {
    if (str1[i] !== str2[i]) {
      distance++;
    }
  }
  
  return distance;
}

/**
 * Compare color histogram hashes
 */
function compareColorHashes(hash1, hash2) {
  if (!hash1 || !hash2) return 1;
  
  let diff = 0;
  const len = Math.min(hash1.length, hash2.length);
  
  for (let i = 0; i < len; i++) {
    const val1 = parseInt(hash1[i], 16);
    const val2 = parseInt(hash2[i], 16);
    diff += Math.abs(val1 - val2);
  }
  
  // Normalize to 0-1 range (1 = identical, 0 = very different)
  const maxDiff = len * 15;
  return 1 - (diff / maxDiff);
}

/**
 * Fallback hash generation
 */
async function generateFallbackHash(buffer) {
  try {
    const resized = await sharp(buffer)
      .resize(16, 16, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();
    
    const pixels = Array.from(resized);
    const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;
    
    let hash = '';
    for (let i = 0; i < pixels.length; i++) {
      hash += pixels[i] > avg ? '1' : '0';
    }
    
    return hash;
  } catch (error) {
    // Return a hash based on file size if all else fails
    const sizeHash = crypto.createHash('md5').update(buffer.length.toString()).digest('hex');
    return sizeHash.repeat(8).substring(0, 256);
  }
}

/**
 * Determine if two images are similar
 */
function areSimilar(hash1, hash2, threshold = 30) {
  const distance = compareHashes(hash1, hash2);
  return distance <= threshold;
}

/**
 * Convert binary hash to hex
 */
function binaryToHex(binaryHash) {
  let hex = '';
  for (let i = 0; i < binaryHash.length; i += 4) {
    const chunk = binaryHash.substring(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex;
}

/**
 * Convert hex to binary
 */
function hexToBinary(hexHash) {
  let binary = '';
  for (let i = 0; i < hexHash.length; i++) {
    binary += parseInt(hexHash[i], 16).toString(2).padStart(4, '0');
  }
  return binary;
}

module.exports = {
  getPerceptualHash,
  generateRobustHash,
  compareHashes,
  areSimilar,
  getDCTHash,
  getColorHash,
  binaryToHex,
  hexToBinary,
  generateFallbackHash,
  hammingDistance
};