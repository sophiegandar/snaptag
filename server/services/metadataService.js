const exiftool = require('node-exiftool');
const ep = new exiftool.ExiftoolProcess();
const fs = require('fs').promises;
const path = require('path');

// Optional sharp dependency with fallback
let sharp = null;
try {
  sharp = require('sharp');
  console.log('✅ Sharp image processing available');
} catch (error) {
  console.log('⚠️  Sharp not available - using fallback mode for image processing');
}

class MetadataService {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await ep.open();
      this.initialized = true;
      console.log('ExifTool initialized');
    }
  }

  async close() {
    if (this.initialized) {
      await ep.close();
      this.initialized = false;
    }
  }

  async addMetadataToImage(imagePath, metadata) {
    await this.init();

    try {
      const { tags, title, description, focusedTags } = metadata;
      
      // Create output path
      const ext = path.extname(imagePath);
      const outputPath = imagePath.replace(ext, `_tagged${ext}`);

      // Prepare metadata for ExifTool
      console.log(`🔧 Debug - tags input:`, tags);
      console.log(`🔧 Debug - tags type:`, typeof tags, Array.isArray(tags));
      
      const metadataArgs = {
        'IPTC:Keywords': tags,
        'XMP:Subject': tags,
        'XMP:Title': title || '',
        'XMP:Description': description || '',
        'IPTC:Caption-Abstract': description || '',
        'IPTC:ObjectName': title || '',
        'XMP:Creator': 'Archier SnapTag',
        'IPTC:By-line': 'Archier SnapTag',
        'XMP:Rights': 'Copyright Archier',
        'IPTC:CopyrightNotice': 'Copyright Archier'
      };
      
      console.log(`🔧 Debug - metadataArgs:`, JSON.stringify(metadataArgs, null, 2));

      // Add focused tags as custom XMP data
      if (focusedTags && focusedTags.length > 0) {
        metadataArgs['XMP:SnapTagFocusedTags'] = JSON.stringify(focusedTags);
      }

      // Write metadata to image
      console.log(`🔧 Debug - About to write metadata to: ${imagePath}`);
      console.log(`🔧 Debug - ExifTool process initialized:`, this.initialized);
      
      // Use different approach - don't use -overwrite_original for temp files
      const result = await ep.writeMetadata(imagePath, metadataArgs);
      console.log(`🔧 Debug - ExifTool result:`, result);
      
      // Verify the metadata was written
      try {
        const verifyResult = await ep.readMetadata(imagePath, ['-s', '-j']);
        console.log(`🔧 Debug - Verification read result:`, JSON.stringify(verifyResult, null, 2));
        if (verifyResult.data && verifyResult.data.length > 0) {
          const writtenTags = this.extractTags(verifyResult.data[0]);
          console.log(`✅ Verified tags written: ${writtenTags.join(', ')}`);
        }
      } catch (verifyError) {
        console.error(`⚠️ Could not verify written metadata:`, verifyError.message);
      }

      console.log(`✅ Metadata added to image: ${imagePath}`);
      return imagePath;
    } catch (error) {
      console.error('Error adding metadata:', error);
      throw new Error(`Failed to add metadata: ${error.message}`);
    }
  }

  async readMetadata(imagePath) {
    await this.init();

    try {
      const metadata = await ep.readMetadata(imagePath, ['-s', '-j']);
      
      if (metadata.data && metadata.data.length > 0) {
        const data = metadata.data[0];
        
        return {
          tags: this.extractTags(data),
          title: data['XMP:Title'] || data['IPTC:ObjectName'] || '',
          description: data['XMP:Description'] || data['IPTC:Caption-Abstract'] || '',
          creator: data['XMP:Creator'] || data['IPTC:By-line'] || '',
          rights: data['XMP:Rights'] || data['IPTC:CopyrightNotice'] || '',
          focusedTags: this.extractFocusedTags(data),
          dateCreated: data['IPTC:DateCreated'] || data['EXIF:CreateDate'] || '',
          imageWidth: data['EXIF:ImageWidth'] || data['File:ImageWidth'] || 0,
          imageHeight: data['EXIF:ImageHeight'] || data['File:ImageHeight'] || 0,
          fileSize: data['File:FileSize'] || 0,
          mimeType: data['File:MIMEType'] || ''
        };
      }
      
      return {};
    } catch (error) {
      console.error('Error reading metadata:', error);
      throw new Error(`Failed to read metadata: ${error.message}`);
    }
  }

  async updateImageMetadata(imagePath, newMetadata) {
    // Full implementation - download, update metadata, and re-upload
    const dropboxService = require('./dropboxService');
    const fs = require('fs').promises;
    const tempPath = `temp/update-${Date.now()}-${path.basename(imagePath)}`;
    
    try {
      console.log(`📝 Updating metadata for: ${imagePath}`);
      console.log(`   Tags: ${newMetadata.tags ? newMetadata.tags.join(', ') : 'none'}`);
      console.log(`   Focused Tags: ${newMetadata.focusedTags ? newMetadata.focusedTags.length : 0}`);
      
      // Ensure temp directory exists
      const tempDir = 'temp';
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (mkdirError) {
        // Directory might already exist, ignore
      }
      
      // Download file from Dropbox
      console.log(`📥 Downloading file for metadata update...`);
      await dropboxService.downloadFile(imagePath, tempPath);
      
      // Verify file was downloaded
      const stats = await fs.stat(tempPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      console.log(`✅ File downloaded successfully (${stats.size} bytes)`);
      
      // Combine regular tags with focused tag names for searchability
      let allTags = [...(newMetadata.tags || [])];
      if (newMetadata.focusedTags && newMetadata.focusedTags.length > 0) {
        const focusedTagNames = newMetadata.focusedTags.map(ft => ft.tag_name || ft.name).filter(Boolean);
        allTags = [...allTags, ...focusedTagNames];
      }
      
      // Remove duplicates and filter out empty tags
      allTags = [...new Set(allTags.filter(tag => tag && tag.trim()))];
      
      console.log(`🏷️ Final tags to embed: ${allTags.join(', ')}`);
      
      // Update metadata with all tags (regular + focused)
      await this.addMetadataToImage(tempPath, {
        tags: allTags,
        title: newMetadata.title || '',
        description: newMetadata.description || '',
        focusedTags: newMetadata.focusedTags
      });
      
      // Re-upload to Dropbox with updated metadata (overwrite existing file)
      console.log(`📤 Re-uploading file with embedded metadata (overwriting original)...`);
      await dropboxService.uploadFile(tempPath, imagePath, true);
      
      // Clean up temp file
      await fs.unlink(tempPath);
      
      console.log(`✅ Metadata successfully embedded in: ${imagePath}`);
      console.log(`🔍 Tags now searchable in Dropbox: ${allTags.join(', ')}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating metadata:', error);
      console.error('❌ Error details:', error.stack);
      
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  async updateImageMetadataFull(imagePath, newMetadata) {
    // Full version with download/upload (has SDK issue currently)
    const dropboxService = require('./dropboxService');
    const tempPath = `temp/update-${Date.now()}-${path.basename(imagePath)}`;
    
    try {
      // Download file
      await dropboxService.downloadFile(imagePath, tempPath);
      
      // Update metadata
      await this.addMetadataToImage(tempPath, newMetadata);
      
      // Re-upload
      await dropboxService.uploadFile(tempPath, imagePath);
      
      // Cleanup
      await fs.unlink(tempPath);
      
      console.log(`Metadata updated for: ${imagePath}`);
    } catch (error) {
      console.error('Error updating metadata:', error);
      // Cleanup on error
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  extractTags(metadata) {
    const tags = [];
    
    // Try different metadata fields for tags
    const keywordFields = [
      'IPTC:Keywords',
      'XMP:Subject',
      'EXIF:Keywords',
      'XMP:Keywords'
    ];

    for (const field of keywordFields) {
      if (metadata[field]) {
        if (Array.isArray(metadata[field])) {
          tags.push(...metadata[field]);
        } else if (typeof metadata[field] === 'string') {
          // Handle comma-separated or semicolon-separated tags
          const splitTags = metadata[field].split(/[,;]/).map(tag => tag.trim()).filter(Boolean);
          tags.push(...splitTags);
        }
      }
    }

    // Remove duplicates and return
    return [...new Set(tags)];
  }

  extractFocusedTags(metadata) {
    try {
      if (metadata['XMP:SnapTagFocusedTags']) {
        return JSON.parse(metadata['XMP:SnapTagFocusedTags']);
      }
    } catch (error) {
      console.error('Error parsing focused tags:', error);
    }
    return [];
  }

  async optimizeImage(imagePath, options = {}) {
    try {
      if (!sharp) {
        console.log('⚠️  Sharp not available - returning original image path');
        return imagePath; // Return original if sharp not available
      }

      const {
        maxWidth = 2048,
        maxHeight = 2048,
        quality = 85,
        format = 'jpeg'
      } = options;

      const outputPath = imagePath.replace(path.extname(imagePath), `_optimized.${format}`);

      await sharp(imagePath)
        .resize(maxWidth, maxHeight, {
          fit: sharp.fit.inside,
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error('Error optimizing image:', error);
      console.log('⚠️  Falling back to original image');
      return imagePath; // Fallback to original
    }
  }

  async generateThumbnail(imagePath, options = {}) {
    try {
      if (!sharp) {
        console.log('⚠️  Sharp not available - returning original image for thumbnail');
        return imagePath; // Return original if sharp not available
      }

      const {
        width = 300,
        height = 300,
        format = 'jpeg',
        quality = 80
      } = options;

      const thumbnailPath = imagePath.replace(
        path.extname(imagePath), 
        `_thumb_${width}x${height}.${format}`
      );

      await sharp(imagePath)
        .resize(width, height, {
          fit: sharp.fit.cover,
          position: sharp.strategy.smart
        })
        .jpeg({ quality })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      console.log('⚠️  Falling back to original image for thumbnail');
      return imagePath; // Fallback to original
    }
  }

  // Auto-tagging using basic image analysis
  async generateAutoTags(imagePath) {
    try {
      if (!sharp) {
        console.log('⚠️  Sharp not available - generating basic auto tags from file info');
        const tags = [];
        
        // Basic tags from file extension
        const ext = path.extname(imagePath).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') {
          tags.push('format-jpeg');
        } else if (ext === '.png') {
          tags.push('format-png');
        } else if (ext === '.webp') {
          tags.push('format-webp');
        }
        
        return tags;
      }

      const metadata = await sharp(imagePath).metadata();
      const tags = [];

      // Basic categorization based on image properties
      if (metadata.width && metadata.height) {
        const aspectRatio = metadata.width / metadata.height;
        
        if (aspectRatio > 1.5) {
          tags.push('landscape-orientation');
        } else if (aspectRatio < 0.75) {
          tags.push('portrait-orientation');
        } else {
          tags.push('square-orientation');
        }

        // Size categories
        const pixels = metadata.width * metadata.height;
        if (pixels > 8000000) { // > 8MP
          tags.push('high-resolution');
        } else if (pixels < 1000000) { // < 1MP
          tags.push('low-resolution');
        }
      }

      // Color space
      if (metadata.space) {
        tags.push(`colorspace-${metadata.space.toLowerCase()}`);
      }

      // Format
      if (metadata.format) {
        tags.push(`format-${metadata.format.toLowerCase()}`);
      }

      return tags;
    } catch (error) {
      console.error('Error generating auto tags:', error);
      return [];
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  const metadataService = new MetadataService();
  await metadataService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  const metadataService = new MetadataService();
  await metadataService.close();
  process.exit(0);
});

module.exports = new MetadataService(); 