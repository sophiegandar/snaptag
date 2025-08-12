const crypto = require('crypto');
const fs = require('fs').promises;

// Optional sharp dependency for image processing
let sharp = null;
try {
  sharp = require('sharp');
  console.log('✅ Sharp available for visual duplicate detection');
} catch (err) {
  console.log('⚠️  Sharp not available - visual duplicate detection will be limited');
}

class DuplicateDetectionService {
  constructor(databaseService, dropboxService) {
    this.databaseService = databaseService;
    this.dropboxService = dropboxService;
  }

  /**
   * Generate a perceptual hash of an image for visual similarity detection
   */
  async generatePerceptualHash(imageBuffer) {
    if (!sharp) {
      throw new Error('Sharp library not available for visual duplicate detection');
    }

    try {
      // Resize to 8x8 grayscale for consistent hashing
      const processedImage = await sharp(imageBuffer)
        .resize(8, 8, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();

      // Convert to array of pixel values
      const pixels = Array.from(processedImage);
      
      // Calculate average pixel value
      const avg = pixels.reduce((sum, pixel) => sum + pixel, 0) / pixels.length;
      
      // Create hash based on pixels above/below average
      let hash = '';
      for (let i = 0; i < pixels.length; i++) {
        hash += pixels[i] >= avg ? '1' : '0';
      }
      
      return hash;
    } catch (error) {
      console.error('Error generating perceptual hash:', error);
      throw error;
    }
  }

  /**
   * Calculate Hamming distance between two binary hashes
   */
  calculateHammingDistance(hash1, hash2) {
    if (hash1.length !== hash2.length) {
      return Infinity;
    }
    
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    
    return distance;
  }

  /**
   * Scan all images for visual duplicates
   */
  async scanForVisualDuplicates(similarityThreshold = 5) {
    console.log('🔍 Starting visual duplicate detection scan...');
    
    if (!sharp) {
      throw new Error('Sharp library is required for visual duplicate detection. Please install it: npm install sharp');
    }

    try {
      // Get all images from database
      const result = await this.databaseService.query(`
        SELECT id, filename, dropbox_path, file_hash
        FROM images 
        ORDER BY id ASC
      `);
      
      const images = result.rows;
      console.log(`📊 Analyzing ${images.length} images for visual duplicates...`);

      const duplicateGroups = [];
      const processedHashes = new Map(); // id -> hash
      const duplicateMap = new Map(); // hash -> [image_ids]

      let processed = 0;
      let errors = 0;

      for (const image of images) {
        try {
          console.log(`📸 Processing image ${processed + 1}/${images.length}: ${image.filename}`);
          
          // Download image from Dropbox
          const imageBuffer = await this.dropboxService.downloadFile(image.dropbox_path);
          
          // Generate perceptual hash
          const perceptualHash = await this.generatePerceptualHash(imageBuffer);
          processedHashes.set(image.id, perceptualHash);
          
          // Check for similar hashes
          let foundSimilar = false;
          
          for (const [existingId, existingHash] of processedHashes) {
            if (existingId === image.id) continue;
            
            const distance = this.calculateHammingDistance(perceptualHash, existingHash);
            
            if (distance <= similarityThreshold) {
              console.log(`🔗 Found visual duplicate: ${image.filename} similar to image ${existingId} (distance: ${distance})`);
              
              // Find or create duplicate group
              let group = duplicateGroups.find(g => g.some(img => img.id === existingId));
              if (!group) {
                const existingImage = images.find(img => img.id === existingId);
                group = [existingImage];
                duplicateGroups.push(group);
              }
              
              // Add current image to the group if not already there
              if (!group.some(img => img.id === image.id)) {
                group.push(image);
              }
              
              foundSimilar = true;
              break;
            }
          }
          
          processed++;
          
        } catch (error) {
          console.error(`❌ Error processing image ${image.filename}:`, error);
          errors++;
        }
      }

      // Calculate statistics
      const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.length, 0);
      const duplicateImages = totalDuplicates - duplicateGroups.length; // Subtract one "original" per group

      console.log(`✅ Visual duplicate scan completed:`);
      console.log(`   📊 Processed: ${processed} images`);
      console.log(`   🔗 Duplicate groups found: ${duplicateGroups.length}`);
      console.log(`   📸 Total duplicate images: ${duplicateImages}`);
      console.log(`   ❌ Errors: ${errors}`);

      return {
        success: true,
        stats: {
          totalImages: images.length,
          processedImages: processed,
          duplicateGroups: duplicateGroups.length,
          duplicateImages: duplicateImages,
          errors: errors
        },
        duplicateGroups: duplicateGroups.map(group => ({
          images: group.map(img => ({
            id: img.id,
            filename: img.filename,
            dropbox_path: img.dropbox_path
          })),
          count: group.length
        }))
      };

    } catch (error) {
      console.error('❌ Visual duplicate detection failed:', error);
      throw error;
    }
  }

  /**
   * Remove duplicate images (keeping the first one in each group)
   */
  async removeDuplicates(duplicateGroups, keepFirstInGroup = true) {
    console.log('🗑️ Starting duplicate removal...');
    
    let removed = 0;
    let errors = 0;

    for (const group of duplicateGroups) {
      if (group.images.length <= 1) continue;

      // Sort by ID to ensure consistent "first" selection
      const sortedImages = group.images.sort((a, b) => a.id - b.id);
      const imagesToRemove = keepFirstInGroup ? sortedImages.slice(1) : sortedImages.slice(0, -1);

      for (const image of imagesToRemove) {
        try {
          console.log(`🗑️ Removing duplicate: ${image.filename}`);
          
          // Delete from Dropbox
          await this.dropboxService.deleteFile(image.dropbox_path);
          
          // Delete from database
          await this.databaseService.query('DELETE FROM image_tags WHERE image_id = $1', [image.id]);
          await this.databaseService.query('DELETE FROM focused_tags WHERE image_id = $1', [image.id]);
          await this.databaseService.query('DELETE FROM images WHERE id = $1', [image.id]);
          
          removed++;
          
        } catch (error) {
          console.error(`❌ Error removing duplicate ${image.filename}:`, error);
          errors++;
        }
      }
    }

    console.log(`✅ Duplicate removal completed: ${removed} removed, ${errors} errors`);
    
    return {
      removed: removed,
      errors: errors
    };
  }
}

module.exports = DuplicateDetectionService; 