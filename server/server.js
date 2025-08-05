const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dropboxService = require('./services/dropboxService');
const metadataService = require('./services/metadataService');
const PostgresService = require('./services/postgresService');
const { generateFileHash } = require('./utils/fileHash');

// Initialize PostgreSQL service
const databaseService = new PostgresService();

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

// Get all images with tags
app.get('/api/images', async (req, res) => {
  try {
    const { search, tags } = req.query;
    const images = await databaseService.searchImages(search, tags);
    
    // Generate temporary Dropbox URLs for each image
    console.log(`🔗 Generating temporary URLs for ${images.length} images...`);
    for (const image of images) {
      try {
        image.url = await dropboxService.getTemporaryLink(image.dropbox_path);
        console.log(`✅ Generated URL for ${image.filename}`);
      } catch (error) {
        console.error(`❌ Failed to generate URL for ${image.filename}:`, error.message);
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
    const { id } = req.params;
    const { tags, focusedTags } = req.body;

    console.log(`🏷️ Updating tags for image ${id}:`, { tags, focusedTags });

    // Update database first
    await databaseService.updateImageTags(id, tags, focusedTags);
    console.log('✅ Database tags updated successfully');
    
    // Try to update metadata in Dropbox file (non-blocking)
    const image = await databaseService.getImageById(id);
    if (image) {
      try {
        console.log('📝 Attempting to embed metadata in Dropbox file...');
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
        console.log('✅ Tags saved to database successfully (metadata embedding can be retried later)');
      }
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
    
    const image = await databaseService.getImageById(id);
    if (image) {
      // Delete from Dropbox
      await dropboxService.deleteFile(image.dropbox_path);
      
      // Delete from database
      await databaseService.deleteImage(id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
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
        image.url = await dropboxService.getTemporaryLink(image.dropbox_path);
        console.log(`✅ Generated URL for ${image.filename}`);
      } catch (error) {
        console.error(`❌ Failed to generate URL for ${image.filename}:`, error.message);
        image.url = null; // Set to null if failed
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

  // Generate unique filename
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const filename = `${timestamp}-${path.basename(originalName, ext)}${ext}`;
  const dropboxFolder = serverSettings.dropboxFolder || process.env.DROPBOX_FOLDER || '/SnapTag';
  // Ensure dropboxFolder starts with '/' for Dropbox API compatibility
  const normalizedFolder = dropboxFolder.startsWith('/') ? dropboxFolder : `/${dropboxFolder}`;
  const dropboxPath = `${normalizedFolder}/${filename}`;
  console.log('📂 Dropbox path:', dropboxPath);

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

    console.log('💾 Adding source URL to database...');
    // Add source URL to database
    await databaseService.updateImageSource(result.id, sourceUrl);

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
  dropboxFolder: process.env.DROPBOX_FOLDER || '/SnapTag'
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
    serverSettings.dropboxFolder = process.env.DROPBOX_FOLDER || serverSettings.dropboxFolder || '/SnapTag';
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