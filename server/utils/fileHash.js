const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * Generate SHA-256 hash of a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - SHA-256 hash as hex string
 */
async function generateFileHash(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  } catch (error) {
    console.error('Error generating file hash:', error);
    throw new Error(`Failed to generate file hash: ${error.message}`);
  }
}

/**
 * Generate hash from buffer (for already-loaded files)
 * @param {Buffer} buffer - File buffer
 * @returns {string} - SHA-256 hash as hex string
 */
function generateBufferHash(buffer) {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

module.exports = {
  generateFileHash,
  generateBufferHash
}; 