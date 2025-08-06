const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dropboxService = require('./services/dropboxService');
const metadataService = require('./services/metadataService');
const PostgresService = require('./services/postgresService');
const FolderPathService = require('./services/folderPathService');
const { generateFileHash } = require('./utils/fileHash');

// Initialize services
const databaseService = new PostgresService();
const folderPathService = new FolderPathService();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Security middleware with custom CSP for Dropbox images
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://*.dropboxusercontent.com", "https://*.dropbox.com", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer setup for file uploads
const upload = multer({
  dest: 'temp/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff|tif|webp|heic|heif|svg|avif|jp2|j2k|jpx|jpm|tga|targa/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                     file.mimetype.includes('image/') || // Catch newer MIME types
                     file.mimetype.includes('heic') ||
                     file.mimetype.includes('heif') ||
                     file.mimetype.includes('avif') ||
                     file.mimetype.includes('svg') ||
                     file.mimetype.includes('jp2') ||
                     file.mimetype.includes('targa');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Placeholder image endpoint
app.get('/api/placeholder-image.jpg', (req, res) => {
  // Create a simple SVG placeholder
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#f3f4f6"/>
      <text x="200" y="140" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle">
        SnapTag
      </text>
      <text x="200" y="170" font-family="Arial, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">
        Image not available
      </text>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
});

// Debug endpoint to test individual image URL generation
app.get('/api/debug/image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Debug: Testing image URL generation for ID: ${id}`);
    
    const image = await databaseService.getImageById(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    console.log(`📂 Debug: Image found - ${image.filename}`);
    console.log(`📂 Debug: Dropbox path - ${image.dropbox_path}`);
    
    try {
      const url = await dropboxService.getTemporaryLink(image.dropbox_path);
      console.log(`✅ Debug: URL generated successfully`);
      console.log(`🔗 Debug: URL length: ${url ? url.length : 'null'}`);
      console.log(`🔗 Debug: URL preview: ${url ? url.substring(0, 100) + '...' : 'null'}`);
      
      res.json({
        success: true,
        image: {
          id: image.id,
          filename: image.filename,
          dropbox_path: image.dropbox_path,
          url: url
        },
        debug: {
          url_length: url ? url.length : 0,
          url_preview: url ? url.substring(0, 100) + '...' : null,
          timestamp: new Date().toISOString()
        }
      });
    } catch (urlError) {
      console.error(`❌ Debug: Failed to generate URL:`, urlError.message);
      res.status(500).json({
        error: 'Failed to generate URL',
        debug: {
          dropbox_path: image.dropbox_path,
          error_message: urlError.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug failed', message: error.message });
  }
});

// Get all images with tags
app.get('/api/images', async (req, res) => {
  try {
    const { search, tags } = req.query;
    const images = await databaseService.searchImages(search, tags);
    
    // Generate temporary Dropbox URLs for each image
    console.log(`🔗 Generating temporary URLs for ${images.length} images...`);
    for (const image of images) {
      try {
        console.log(`🔗 Generating URL for: ${image.dropbox_path}`);
        image.url = await dropboxService.getTemporaryLink(image.dropbox_path);
        console.log(`✅ Generated URL for ${image.filename}: ${image.url ? 'success' : 'null'}`);
      } catch (error) {
        console.error(`❌ Failed to generate URL for ${image.filename}:`, error.message);
        console.error(`❌ Dropbox path: ${image.dropbox_path}`);
        console.error(`❌ Error details:`, error);
        image.url = null; // Set to null if failed
      }
    }
    
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get available image sources (must be before /api/images/:id route)
app.get('/api/images/sources', async (req, res) => {
  try {
    console.log('📊 Getting available image sources...');
    const sources = await databaseService.getImageSources();
    console.log(`✅ Found ${sources.length} unique sources`);
    res.json(sources);
  } catch (error) {
    console.error('Error fetching image sources:', error);
    res.status(500).json({ error: 'Failed to fetch image sources' });
  }
});

// Get system statistics (must be before /api/images/:id route)
app.get('/api/images/stats', async (req, res) => {
  try {
    const stats = await databaseService.getImageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get single image by ID
app.get('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const image = await databaseService.getImageById(id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get temporary Dropbox URL
    image.url = await dropboxService.getTemporaryLink(image.dropbox_path);
    
    res.json(image);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Upload and tag image
app.post('/api/images/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { tags, title, description, focusedTags } = req.body;
    const tempFilePath = req.file.path;
    
    // Parse tags
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags || [];
    const parsedFocusedTags = typeof focusedTags === 'string' ? JSON.parse(focusedTags) : focusedTags || [];

    // Process image and upload to Dropbox
    const result = await processAndUploadImage({
      filePath: tempFilePath,
      originalName: req.file.originalname,
      tags: parsedTags,
      title,
      description,
      focusedTags: parsedFocusedTags
    });

    // Clean up temp file
    await fs.unlink(tempFilePath);

    res.json(result);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Save image from URL (for browser extension)
app.post('/api/images/save-from-url', async (req, res) => {
  try {
    const { imageUrl, tags, title, description, focusedTags, sourceUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Check for duplicate by URL first (fastest check)
    console.log('🔍 Checking for duplicate by URL:', imageUrl);
    const existingByUrl = await databaseService.checkDuplicateByUrl(imageUrl);
    
    if (existingByUrl) {
      console.log('♻️ Duplicate found by URL:', existingByUrl.filename);
      return res.json({
        ...existingByUrl,
        duplicate: true,
        message: 'Image already exists',
        url: await dropboxService.getTemporaryLink(existingByUrl.dropbox_path)
      });
    }

    console.log('🔄 Starting image save from URL:', imageUrl);
    const result = await saveImageFromUrl({
      imageUrl,
      tags: tags || [],
      title,
      description,
      focusedTags: focusedTags || [],
      sourceUrl
    });

    console.log('✅ Image saved successfully:', result.filename);
    res.json(result);
  } catch (error) {
    console.error('❌ Error saving image from URL:', error);
    console.error('❌ Full error details:', error.message, error.stack);
    res.status(500).json({ error: `Failed to save image from URL: ${error.message}` });
  }
});

// Update image tags
app.put('/api/images/:id/tags', async (req, res) => {
  try {
    console.log('🔧 DEBUG: Tag update endpoint called');
    const { id } = req.params;
    const { tags, focusedTags } = req.body;

    console.log(`🏷️ Updating tags for image ${id}:`, { tags, focusedTags });
    console.log('🔧 DEBUG: About to update database tags');

    // Update database first
    await databaseService.updateImageTags(id, tags, focusedTags);
    console.log('✅ Database tags updated successfully');
    console.log('🔧 DEBUG: About to get image for metadata embedding');
    
    // Try to update metadata in Dropbox file (non-blocking)
    const image = await databaseService.getImageById(id);
    console.log('🔧 DEBUG: Retrieved image:', image ? 'found' : 'not found');
    if (image) {
      try {
        console.log('📝 Attempting to embed metadata in Dropbox file...');
        console.log('🔧 DEBUG: Calling metadataService.updateImageMetadata');
      await metadataService.updateImageMetadata(image.dropbox_path, {
        tags,
          focusedTags,
          title: image.title,
          description: image.description
        });
        console.log('✅ Metadata embedding completed');
      } catch (metadataError) {
        // Don't fail the whole request if metadata embedding fails
        console.error('⚠️ Metadata embedding failed (non-critical):', metadataError.message);
        console.error('🔧 DEBUG: Full metadata error:', metadataError);
        console.log('✅ Tags saved to database successfully (metadata embedding can be retried later)');
      }
    } else {
      console.log('🔧 DEBUG: No image found, skipping metadata embedding');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating tags:', error);
    res.status(500).json({ error: 'Failed to update tags: ' + error.message });
  }
});

// Delete image
app.delete('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Attempting to delete image with ID: ${id}`);
    
    const image = await databaseService.getImageById(id);
    if (!image) {
      console.log(`❌ Image with ID ${id} not found in database`);
      return res.status(404).json({ error: 'Image not found' });
    }
    
    console.log(`📂 Deleting from Dropbox: ${image.dropbox_path}`);
    try {
      await dropboxService.deleteFile(image.dropbox_path);
      console.log(`✅ Deleted from Dropbox successfully`);
    } catch (dropboxError) {
      console.error(`❌ Failed to delete from Dropbox:`, dropboxError.message);
      // Continue with database deletion even if Dropbox fails
    }
    
    console.log(`🗄️ Deleting from database...`);
    await databaseService.deleteImage(id);
    console.log(`✅ Deleted from database successfully`);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: `Failed to delete image: ${error.message}` });
  }
});

// Get available tags
app.get('/api/tags', async (req, res) => {
  try {
    const tags = await databaseService.getAllTags();
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Delete a tag
app.delete('/api/tags/:id', async (req, res) => {
  try {
    const tagId = req.params.id;
    console.log('🗑️ Deleting tag with ID:', tagId);
    
    // First check if tag exists
    const tagResult = await databaseService.query('SELECT * FROM tags WHERE id = $1', [tagId]);
    if (tagResult.rows.length === 0) {
      console.log('❌ Tag not found with ID:', tagId);
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    const tagName = tagResult.rows[0].name;
    console.log('🗑️ Found tag to delete:', tagName);
    
    // Delete all image_tag relationships first
    await databaseService.run('DELETE FROM image_tags WHERE tag_id = $1', [tagId]);
    console.log('✅ Deleted image-tag relationships for tag:', tagName);
    
    // Delete the tag itself
    await databaseService.run('DELETE FROM tags WHERE id = $1', [tagId]);
    
    console.log('✅ Tag deleted successfully:', tagName);
    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// Batch apply tags to multiple images
app.post('/api/batch/apply-tags', async (req, res) => {
  try {
    const { imageIds, tags } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'Image IDs array is required' });
    }
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Tags array is required' });
    }
    
    console.log(`🏷️ Batch applying tags to ${imageIds.length} images:`, tags);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];
    const duplicateInfo = [];
    const processedImages = [];
    
    for (const imageId of imageIds) {
      try {
        // Get current image data
        const image = await databaseService.getImageById(imageId);
        if (!image) {
          errors.push(`Image ${imageId} not found`);
          errorCount++;
          continue;
        }
        
        // Get current tags
        let currentTags = [];
        if (Array.isArray(image.tags)) {
          currentTags = image.tags;
        } else if (typeof image.tags === 'string') {
          currentTags = image.tags.split(',').map(t => t.trim()).filter(Boolean);
        }
        
        // Normalize tags for comparison (case-insensitive duplicate prevention)
        const normalizedCurrentTags = currentTags.map(tag => tag.toLowerCase().trim());
        const normalizedNewTags = tags.map(tag => tag.toLowerCase().trim());
        
        // Check if any new tags are already present
        const duplicateTags = normalizedNewTags.filter(tag => normalizedCurrentTags.includes(tag));
        if (duplicateTags.length > 0) {
          console.log(`⚠️ Skipping duplicate tags for image ${imageId}:`, duplicateTags);
          duplicateInfo.push({
            imageId: imageId,
            filename: image.filename,
            duplicateTags: tags.filter(tag => normalizedCurrentTags.includes(tag.toLowerCase().trim()))
          });
        }
        
        // Only add truly new tags
        const uniqueNewTags = tags.filter(tag => !normalizedCurrentTags.includes(tag.toLowerCase().trim()));
        
        if (uniqueNewTags.length === 0) {
          console.log(`✅ No new tags to add for image ${imageId} (all tags already exist)`);
          skippedCount++;
          continue;
        }
        
        // Merge with new unique tags
        const allTags = [...currentTags, ...uniqueNewTags];
        
        console.log(`🏷️ Adding ${uniqueNewTags.length} new tags to image ${imageId}:`, uniqueNewTags);
        
        // Update tags in database
        await databaseService.updateImageTags(imageId, allTags, image.focused_tags || []);
        
        // Check if folder reorganization is needed
        const baseDropboxFolder = serverSettings.dropboxFolder || process.env.DROPBOX_FOLDER || '/ARCHIER Team Folder/Support/Production/SnapTag';
        const normalizedBaseFolder = baseDropboxFolder.startsWith('/') ? baseDropboxFolder : `/${baseDropboxFolder}`;
        const newFolderPath = folderPathService.generateFolderPath(allTags, normalizedBaseFolder);
        const ext = path.extname(image.filename);
        const timestamp = Date.now();
        const newFilename = folderPathService.generateTagBasedFilename(allTags, ext, timestamp);
        const newDropboxPath = path.posix.join(newFolderPath, newFilename);
        
        // Move file in Dropbox if path has changed
        if (image.dropbox_path !== newDropboxPath) {
          console.log(`📁 Moving file from: ${image.dropbox_path}`);
          console.log(`📁 Moving file to: ${newDropboxPath}`);
          
          try {
            // Use fast Dropbox move API instead of download-upload-delete
            await dropboxService.moveFile(image.dropbox_path, newDropboxPath);
            
            // Update database with new path and filename
            await databaseService.query(
              'UPDATE images SET dropbox_path = $1, filename = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
              [newDropboxPath, newFilename, imageId]
            );
            
            console.log(`✅ Successfully moved file to new folder structure`);
          } catch (moveError) {
            console.error(`❌ Failed to move file in Dropbox:`, moveError.message);
            errors.push(`Image ${imageId}: Failed to reorganize in Dropbox - ${moveError.message}`);
            errorCount++;
            continue;
          }
        }
        
        console.log(`✅ Updated tags for image ${imageId}`);
        successCount++;
        processedImages.push({
          imageId: imageId,
          filename: image.filename,
          addedTags: uniqueNewTags,
          moved: image.dropbox_path !== newDropboxPath
        });
        
      } catch (error) {
        console.error(`❌ Error updating tags for image ${imageId}:`, error.message);
        errors.push(`Image ${imageId}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Create detailed message
    let message = `Batch tagging completed: ${successCount} updated`;
    if (skippedCount > 0) message += `, ${skippedCount} skipped (duplicates)`;
    if (errorCount > 0) message += `, ${errorCount} errors`;
    
    console.log(message);
    
    res.json({
      success: true,
      message,
      stats: {
        total: imageIds.length,
        successful: successCount,
        skipped: skippedCount,
        errors: errorCount,
        errorDetails: errors,
        duplicateInfo: duplicateInfo,
        processedImages: processedImages
      }
    });
    
  } catch (error) {
    console.error('❌ Batch apply tags error:', error);
    res.status(500).json({ error: 'Failed to apply tags: ' + error.message });
  }
});

// Search images with filters (POST endpoint for frontend)
app.post('/api/images/search', async (req, res) => {
  try {
    const searchFilters = req.body;
    const { searchTerm, tags, sources, dateRange } = searchFilters;
    
    console.log('🔍 Searching images with filters:', searchFilters);
    console.log('🔍 Search parameters:', { searchTerm, tags, sources, dateRange });
    
    // Use existing search functionality but with POST body filters
    console.log('📊 Calling searchImages with:', { searchTerm, tags });
    const images = await databaseService.searchImages(searchTerm, tags);
    console.log('📊 Raw search results:', images.length, 'images found');
    
    // Debug: Log first image details
    if (images.length > 0) {
      console.log(`📊 Sample image details:`, {
        filename: images[0].filename,
        dropbox_path: images[0].dropbox_path,
        tags: images[0].tags
      });
    }
    
    // Filter by sources if specified
    let filteredImages = images;
    if (sources && sources.length > 0) {
      filteredImages = images.filter(image => {
        return sources.some(source => 
          image.source_url && image.source_url.includes(source)
        );
      });
    }
    
    // Filter by date range if specified
    if (dateRange && (dateRange.start || dateRange.end)) {
      filteredImages = filteredImages.filter(image => {
        const imageDate = new Date(image.upload_date);
        if (dateRange.start && imageDate < new Date(dateRange.start)) return false;
        if (dateRange.end && imageDate > new Date(dateRange.end)) return false;
        return true;
      });
    }
    
    // Generate temporary Dropbox URLs for each image
    console.log(`🔗 Generating temporary URLs for ${filteredImages.length} images...`);
    for (const image of filteredImages) {
      try {
        console.log(`🔗 Attempting to generate URL for ${image.filename} at path: ${image.dropbox_path}`);
        image.url = await dropboxService.getTemporaryLink(image.dropbox_path);
        console.log(`✅ Generated URL for ${image.filename}: ${image.url ? 'SUCCESS' : 'EMPTY'}`);
      } catch (error) {
        console.error(`❌ Failed to generate URL for ${image.filename}:`, error.message);
        console.error(`❌ Error details:`, error);
        image.url = '/api/placeholder-image.jpg'; // Use placeholder instead of null
      }
    }
    
    console.log(`✅ Search completed: ${filteredImages.length} images found`);
    res.json(filteredImages);
  } catch (error) {
    console.error('❌ Error searching images:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ error: 'Failed to search images: ' + error.message });
  }
});

// Get untagged images for triage
app.get('/api/images/untagged', async (req, res) => {
  try {
    console.log('🔍 Finding untagged images for triage...');
    
    // Query for images with no tags or empty tags
    const untaggedImages = await databaseService.executeQuery(`
      SELECT i.*, 
             COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN tags t ON it.tag_id = t.id
      GROUP BY i.id, i.filename, i.dropbox_path, i.original_url, i.title, i.description, i.created_at, i.updated_at
      HAVING COUNT(t.id) = 0 OR array_agg(t.name) = '{}'
      ORDER BY i.created_at DESC
    `);
    
    const images = untaggedImages.rows;
    console.log(`📊 Found ${images.length} untagged images`);
    
    // Generate temporary URLs for display
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        try {
          const url = await dropboxService.getTemporaryLink(image.dropbox_path);
          return {
            ...image,
            url,
            tags: [] // Ensure tags is empty array
          };
        } catch (error) {
          console.error(`❌ Failed to get URL for ${image.filename}:`, error.message);
          return {
            ...image,
            url: '/api/placeholder-image.jpg',
            tags: []
          };
        }
      })
    );
    
    res.json({
      success: true,
      count: images.length,
      images: imagesWithUrls,
      message: images.length > 0 
        ? `Found ${images.length} untagged image(s) that need attention`
        : 'All images are properly tagged!'
    });
    
  } catch (error) {
    console.error('❌ Error finding untagged images:', error);
    res.status(500).json({ error: 'Failed to find untagged images: ' + error.message });
  }
});

// Get triage statistics
app.get('/api/triage/stats', async (req, res) => {
  try {
    console.log('📊 Getting triage statistics...');
    
    // Get total image count
    const totalResult = await databaseService.query('SELECT COUNT(*) as total FROM images');
    const totalImages = parseInt(totalResult.rows[0].total);
    
    // Get untagged count
    const untaggedResult = await databaseService.query(`
      SELECT COUNT(*) as untagged
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN tags t ON it.tag_id = t.id
      GROUP BY i.id
      HAVING COUNT(t.id) = 0
    `);
    const untaggedImages = untaggedResult.rows.length;
    
    // Get images with minimal tags (1-2 tags only)
    const minimalTagsResult = await databaseService.query(`
      SELECT COUNT(*) as minimal
      FROM (
        SELECT i.id, COUNT(t.id) as tag_count
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        GROUP BY i.id
        HAVING COUNT(t.id) BETWEEN 1 AND 2
      ) as minimal_tagged
    `);
    const minimalTagsImages = parseInt(minimalTagsResult.rows[0].minimal || 0);
    
    // Get recent untagged (last 7 days)
    const recentUntaggedResult = await databaseService.query(`
      SELECT COUNT(*) as recent_untagged
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN tags t ON it.tag_id = t.id
      WHERE i.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY i.id
      HAVING COUNT(t.id) = 0
    `);
    const recentUntagged = recentUntaggedResult.rows.length;
    
    const taggedImages = totalImages - untaggedImages;
    const taggedPercentage = totalImages > 0 ? Math.round((taggedImages / totalImages) * 100) : 100;
    
    res.json({
      success: true,
      stats: {
        totalImages,
        taggedImages,
        untaggedImages,
        minimalTagsImages,
        recentUntagged,
        taggedPercentage,
        needsAttention: untaggedImages + minimalTagsImages
      },
      alerts: {
        critical: untaggedImages > 0,
        warning: minimalTagsImages > 0,
        recent: recentUntagged > 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting triage stats:', error);
    res.status(500).json({ error: 'Failed to get triage stats: ' + error.message });
  }
});

// Bulk download selected images as ZIP
app.post('/api/images/download-bulk', async (req, res) => {
  try {
    const { searchFilters, filename } = req.body;
    console.log('📦 Starting bulk download for selected images');
    
    // If imageIds are provided, fetch those specific images
    let images = [];
    if (searchFilters && searchFilters.imageIds && searchFilters.imageIds.length > 0) {
      console.log(`📦 Downloading ${searchFilters.imageIds.length} selected images`);
      
      // Get images by IDs
      const imagePromises = searchFilters.imageIds.map(id => databaseService.getImageById(id));
      const imageResults = await Promise.all(imagePromises);
      images = imageResults.filter(img => img !== null); // Remove any null results
    } else {
      return res.status(400).json({ error: 'No images selected for download' });
    }
    
    if (images.length === 0) {
      return res.status(404).json({ error: 'No images found for download' });
    }
    
    console.log(`📦 Found ${images.length} images for bulk download`);
    
    // Set headers for ZIP download
    const zipFilename = filename || `snaptag-selection-${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    
    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Handle archive errors
    archive.on('error', (err) => {
      console.error('❌ Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create archive' });
      }
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Add each image to the archive
    for (const image of images) {
      try {
        console.log(`📄 Adding ${image.filename} to archive...`);
        
        // Download image from Dropbox to temp location
        const tempPath = `temp/bulk-download-${Date.now()}-${image.filename}`;
        await dropboxService.downloadFile(image.dropbox_path, tempPath);
        
        // Add to archive with organized folder structure
        const archivePath = image.dropbox_path.startsWith('/') ? image.dropbox_path.substring(1) : image.dropbox_path;
        archive.file(tempPath, { name: archivePath });
        
        successCount++;
        
        // Clean up temp file after adding to archive
        setTimeout(async () => {
          try {
            await fs.unlink(tempPath);
          } catch (cleanupError) {
            console.warn('⚠️ Could not clean up temp file:', tempPath);
          }
        }, 5000); // Clean up after 5 seconds
        
      } catch (error) {
        console.error(`❌ Error adding ${image.filename} to archive:`, error.message);
        errorCount++;
        
        // Add error info to archive as text file
        const errorInfo = `Error downloading ${image.filename}: ${error.message}\nDropbox path: ${image.dropbox_path}\n`;
        archive.append(errorInfo, { name: `errors/${image.filename}.error.txt` });
      }
    }
    
    // Add metadata file with export info
    const exportInfo = {
      exportDate: new Date().toISOString(),
      totalImages: images.length,
      successfulDownloads: successCount,
      errors: errorCount,
      images: images.map(img => ({
        filename: img.filename,
        tags: img.tags || [],
        created_at: img.created_at,
        dropbox_path: img.dropbox_path
      }))
    };
    
    archive.append(JSON.stringify(exportInfo, null, 2), { name: 'export-info.json' });
    
    console.log(`📦 Archive complete: ${successCount} successful, ${errorCount} errors`);
    
    // Finalize the archive
    await archive.finalize();
    
  } catch (error) {
    console.error('❌ Bulk download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create bulk download: ' + error.message });
    }
  }
});

// Sync database with Dropbox folder contents
app.post('/api/sync/dropbox', async (req, res) => {
  try {
    console.log('🔄 Starting Dropbox folder sync...');
    
    const folderPath = process.env.DROPBOX_FOLDER || '/ARCHIER Team Folder/Support/Production/SnapTag';
    console.log('📂 Scanning folder:', folderPath);
    
    // Get all images from Dropbox folder
    const dropboxFiles = await dropboxService.listFiles(folderPath, false);
    console.log('📊 Found', dropboxFiles.length, 'files in Dropbox');
    
    // Filter for image files only
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|heic|heif|svg|tiff|avif|jp2|tga)$/i;
    const imageFiles = dropboxFiles.filter(file => 
      file['.tag'] === 'file' && imageExtensions.test(file.name)
    );
    
    console.log('📊 Found', imageFiles.length, 'image files');
    
    // Get all images currently in database
    const dbImages = await databaseService.getAllImages();
    const dbFilenames = new Set(dbImages.map(img => img.filename));
    
    console.log('📊 Database has', dbImages.length, 'images');
    
    // Find images in Dropbox but not in database
    const missingImages = imageFiles.filter(file => !dbFilenames.has(file.name));
    
    console.log('🔍 Found', missingImages.length, 'images not in database');
    
    // Add missing images to database with basic metadata
    let addedCount = 0;
    for (const file of missingImages) {
      try {
        console.log('➕ Adding to database:', file.name);
        
        // Generate basic metadata for orphaned file
        const imageData = {
          filename: file.name,
          original_name: file.name,
          title: `Synced: ${file.name}`,
          description: 'Image found in Dropbox folder during sync',
          dropbox_path: `${folderPath}/${file.name}`,
          file_size: file.size,
          source_url: null,
          tags: ['synced', 'orphaned'], // Mark as synced - use array format
          focused_tags: [],
          upload_date: new Date().toISOString(), // Add required upload_date
          created_at: new Date().toISOString(),  // Add created_at
          updated_at: new Date().toISOString()   // Add updated_at
        };
        
        const imageId = await databaseService.saveImage(imageData);
        console.log('✅ Added image ID:', imageId);
        
        // Embed metadata in the Dropbox file for search functionality
        try {
          console.log('📝 Embedding metadata in synced file...');
          await metadataService.updateImageMetadata(imageData.dropbox_path, {
            tags: imageData.tags,
            focusedTags: imageData.focused_tags,
            title: imageData.title,
            description: imageData.description
          });
          console.log('✅ Metadata embedded in synced file');
        } catch (metadataError) {
          console.error('⚠️ Failed to embed metadata in synced file (non-critical):', metadataError.message);
        }
        
        addedCount++;
        
      } catch (error) {
        console.error('❌ Failed to add', file.name, ':', error.message);
      }
    }
    
    console.log('✅ Sync completed');
    console.log('📊 Summary:');
    console.log('   Dropbox images:', imageFiles.length);
    console.log('   Database images before:', dbImages.length);
    console.log('   Added to database:', addedCount);
    console.log('   Database images after:', dbImages.length + addedCount);
    
    res.json({
      success: true,
      message: 'Dropbox folder synced successfully',
      stats: {
        dropboxImages: imageFiles.length,
        databaseImagesBefore: dbImages.length,
        addedToDatabase: addedCount,
        databaseImagesAfter: dbImages.length + addedCount
      }
    });
    
  } catch (error) {
    console.error('❌ Dropbox sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to sync with Dropbox folder: ' + error.message 
    });
  }
});

// Reorganize existing images into new folder structure
app.post('/api/organize/folders', async (req, res) => {
  try {
    console.log('🗂️ Starting folder reorganization...');
    
    // Get all images from database
    const images = await databaseService.getAllImages();
    console.log(`📊 Found ${images.length} images to potentially reorganize`);
    
    let movedCount = 0;
    let errorCount = 0;
    
    for (const image of images) {
      try {
        console.log(`📁 Processing image: ${image.filename}`);
        
        // Parse existing tags
        const tags = Array.isArray(image.tags) ? image.tags : 
                    typeof image.tags === 'string' ? image.tags.split(',').map(t => t.trim()) : [];
        
        if (tags.length === 0) {
          console.log(`⚠️ Skipping ${image.filename} - no tags found`);
          continue;
        }
        
            // Generate new folder path based on tags
    const baseDropboxFolder = serverSettings.dropboxFolder || process.env.DROPBOX_FOLDER || '/ARCHIER Team Folder/Support/Production/SnapTag';
    const normalizedBaseFolder = baseDropboxFolder.startsWith('/') ? baseDropboxFolder : `/${baseDropboxFolder}`;
        const newFolderPath = folderPathService.generateFolderPath(tags, normalizedBaseFolder);
        
        // Generate new filename from tags
        const ext = path.extname(image.filename);
        const timestamp = Date.now();
        const newFilename = folderPathService.generateTagBasedFilename(tags, ext, timestamp);
        const newDropboxPath = path.posix.join(newFolderPath, newFilename);
        
        // Check if the file is already in the correct location
        if (image.dropbox_path === newDropboxPath) {
          console.log(`✅ ${image.filename} already in correct location`);
          continue;
        }
        
        console.log(`🔄 Moving from: ${image.dropbox_path}`);
        console.log(`🔄 Moving to: ${newDropboxPath}`);
        
        // Use fast Dropbox move API instead of download-upload-delete
        await dropboxService.moveFile(image.dropbox_path, newDropboxPath);
        
        // Update database with new path and filename
        await databaseService.query(
          'UPDATE images SET dropbox_path = $1, filename = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [newDropboxPath, newFilename, image.id]
        );
        
        movedCount++;
        console.log(`✅ Successfully reorganized: ${image.filename}`);
        
      } catch (error) {
        console.error(`❌ Error reorganizing ${image.filename}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('🗂️ Folder reorganization completed');
    console.log(`📊 Summary: ${movedCount} moved, ${errorCount} errors`);
    
    res.json({
      success: true,
      message: 'Folder reorganization completed',
      stats: {
        totalImages: images.length,
        movedImages: movedCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('❌ Folder reorganization failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reorganize folders: ' + error.message 
    });
  }
});

// Clean up single-letter tags (utility endpoint)
app.post('/api/cleanup/single-letter-tags', async (req, res) => {
  try {
    console.log('🧹 Cleaning up single-letter tags...');
    
    // Find all single-letter tags
    const singleLetterTags = await databaseService.all(`
      SELECT id, name FROM tags 
      WHERE LENGTH(name) = 1 AND name ~ '^[a-zA-Z]$'
    `);
    
    console.log(`🔍 Found ${singleLetterTags.length} single-letter tags to remove`);
    
    let removedCount = 0;
    for (const tag of singleLetterTags) {
      try {
        // Remove tag associations
        await databaseService.run('DELETE FROM image_tags WHERE tag_id = $1', [tag.id]);
        // Remove the tag itself
        await databaseService.run('DELETE FROM tags WHERE id = $1', [tag.id]);
        console.log(`🗑️ Removed tag: "${tag.name}"`);
        removedCount++;
      } catch (error) {
        console.error(`❌ Failed to remove tag "${tag.name}":`, error.message);
      }
    }
    
    console.log(`✅ Cleanup completed: removed ${removedCount} single-letter tags`);
    
    res.json({
      success: true,
      message: `Cleaned up ${removedCount} single-letter tags`,
      removedTags: removedCount
    });
  } catch (error) {
    console.error('❌ Tag cleanup failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clean up tags: ' + error.message 
    });
  }
});

// Helper functions
async function processAndUploadImage({ filePath, originalName, tags, title, description, focusedTags }) {
  console.log('🏷️ Adding metadata to image...');
  
  // Check file size before processing
  const statsBefore = await fs.stat(filePath);
  console.log('📊 File size before metadata processing:', statsBefore.size, 'bytes');
  
  // Add metadata to image
  const processedImagePath = await metadataService.addMetadataToImage(filePath, {
    tags,
    title,
    description,
    focusedTags
  });
  console.log('✅ Metadata added, processed image:', processedImagePath);
  
  // Check file size after processing
  const statsAfter = await fs.stat(processedImagePath);
  console.log('📊 File size after metadata processing:', statsAfter.size, 'bytes');
  
  // Check if file is empty
  if (statsAfter.size === 0) {
    throw new Error(`Processed image file is empty: ${processedImagePath}`);
  }

  // Generate file hash for duplicate detection
  console.log('🔒 Generating file hash...');
  const fileHash = await generateFileHash(processedImagePath);
  console.log('✅ File hash generated:', fileHash.substring(0, 16) + '...');

      // Generate folder path based on tags
    const baseDropboxFolder = serverSettings.dropboxFolder || process.env.DROPBOX_FOLDER || '/ARCHIER Team Folder/Support/Production/SnapTag';
    const normalizedBaseFolder = baseDropboxFolder.startsWith('/') ? baseDropboxFolder : `/${baseDropboxFolder}`;
  const folderPath = folderPathService.generateFolderPath(tags, normalizedBaseFolder);
  
  // Generate filename from tags
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const filename = folderPathService.generateTagBasedFilename(tags, ext, timestamp);
  
  // Combine folder path and filename
  const dropboxPath = path.posix.join(folderPath, filename);
  console.log('📂 Final Dropbox path:', dropboxPath);

  console.log('☁️ Uploading to Dropbox...');
  // Upload to Dropbox
  const uploadResult = await dropboxService.uploadFile(processedImagePath, dropboxPath);
  console.log('✅ Uploaded to Dropbox:', uploadResult.id);

  console.log('💾 Saving to database...');
  // Save to database
  const imageData = {
    filename,
    original_name: originalName,
    dropbox_path: dropboxPath,
    tags,
    title,
    description,
    focused_tags: focusedTags,
    upload_date: new Date().toISOString(),
    file_size: uploadResult.size,
    dropbox_id: uploadResult.id,
    file_hash: fileHash
  };

  const imageId = await databaseService.saveImage(imageData);
  console.log('✅ Saved to database with ID:', imageId);

  console.log('🔗 Getting temporary link...');
  return {
    id: imageId,
    ...imageData,
    url: await dropboxService.getTemporaryLink(dropboxPath)
  };
}

async function saveImageFromUrl({ imageUrl, tags, title, description, focusedTags, sourceUrl }) {
  console.log('📥 Downloading image from:', imageUrl);
  
  // Download image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const tempFilePath = `temp/${Date.now()}-downloaded-image`;
  await fs.writeFile(tempFilePath, Buffer.from(buffer));
  console.log('📁 Image downloaded to:', tempFilePath);

  try {
    // Extract filename from URL
    const urlPath = new URL(imageUrl).pathname;
    const originalName = path.basename(urlPath) || 'downloaded-image.jpg';
    console.log('🏷️ Original filename:', originalName);

    console.log('⚙️ Processing and uploading image...');
    const result = await processAndUploadImage({
      filePath: tempFilePath,
      originalName,
      tags,
      title,
      description,
      focusedTags
    });

    console.log('💾 Adding image URL to database...');
    // Add image URL to database for duplicate detection
    await databaseService.updateImageSource(result.id, imageUrl);

    console.log('🎉 Image save completed successfully');
    return result;
  } finally {
    // Clean up temp file
    console.log('🗑️ Cleaning up temp file:', tempFilePath);
    await fs.unlink(tempFilePath);
  }
}

// Settings storage (in-memory for now, could be moved to database)
let serverSettings = {
      dropboxFolder: process.env.DROPBOX_FOLDER || '/ARCHIER Team Folder/Support/Production/SnapTag'
};

// Reload settings from environment on startup
console.log('📁 Current Dropbox folder setting:', serverSettings.dropboxFolder);

// Debug endpoint to check environment variables (remove in production)
app.get('/api/debug/env', (req, res) => {
  try {
    const debugInfo = {
      dropboxFolder: process.env.DROPBOX_FOLDER,
      hasAccessToken: !!process.env.DROPBOX_ACCESS_TOKEN,
      accessTokenPreview: process.env.DROPBOX_ACCESS_TOKEN ? process.env.DROPBOX_ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT_SET',
      selectUser: process.env.DROPBOX_SELECT_USER,
      serverSettings: serverSettings,
      nodeEnv: process.env.NODE_ENV
    };
    
    console.log('🔍 Debug info requested:', debugInfo);
    res.json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// GET settings
app.get('/api/settings', (req, res) => {
  try {
    // Always sync with current environment
    serverSettings.dropboxFolder = process.env.DROPBOX_FOLDER || serverSettings.dropboxFolder || '/ARCHIER Team Folder/Support/Production/SnapTag';
    res.json(serverSettings);
  } catch (error) {
    console.error('Error retrieving settings:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// POST settings  
app.post('/api/settings', (req, res) => {
  try {
    const { dropboxFolder, dropboxToken } = req.body;
    
    // Update server settings
    if (dropboxFolder) {
      serverSettings.dropboxFolder = dropboxFolder;
      // Also update process.env for immediate use
      process.env.DROPBOX_FOLDER = dropboxFolder;
    }
    
    console.log('📝 Settings updated:', serverSettings);
    res.json({ message: 'Settings saved successfully', settings: serverSettings });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Initialize database and start server
async function startServer() {
  try {
    // Debug environment variables
    console.log('🔍 Environment Check:');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('DROPBOX_ACCESS_TOKEN:', process.env.DROPBOX_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('DROPBOX_FOLDER:', process.env.DROPBOX_FOLDER || '❌ Missing');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
    
    // Initialize PostgreSQL database
    await databaseService.init();

app.listen(PORT, () => {
  console.log(`SnapTag server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('✅ PostgreSQL database connected and initialized');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('❌ Error details:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

startServer(); 