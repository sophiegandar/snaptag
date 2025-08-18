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
const TagSuggestionService = require('./services/tagSuggestionService');
const DuplicateDetectionService = require('./services/duplicateDetectionService');
const { generateFileHash } = require('./utils/fileHash');

// Initialize services
const databaseService = new PostgresService();
const folderPathService = new FolderPathService();
const tagSuggestionService = new TagSuggestionService(databaseService);
const duplicateDetectionService = new DuplicateDetectionService(databaseService, dropboxService);

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
      imgSrc: ["'self'", "data:", "blob:", "https://*.dropboxusercontent.com", "https://*.dropbox.com", "https:"],
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

// Simple test endpoint
app.get('/api/debug/simple-test', async (req, res) => {
  try {
    res.json({ success: true, message: 'Simple endpoint working' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check environment variables
app.get('/api/debug/env-check', async (req, res) => {
  try {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasDropbox = !!process.env.DROPBOX_ACCESS_TOKEN;
    
    res.json({ 
      success: true,
      environment: {
        hasOpenAIKey: hasOpenAI,
        openAIKeyPreview: hasOpenAI ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'MISSING',
        hasDropboxToken: hasDropbox,
        dropboxTokenPreview: hasDropbox ? process.env.DROPBOX_ACCESS_TOKEN.substring(0, 10) + '...' : 'MISSING'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to test untagged query
app.get('/api/debug/untagged-test', async (req, res) => {
  try {
    console.log('🔍 Debug: Testing untagged query...');
    
    // Test basic query first
    const allImages = await databaseService.all(`SELECT id, filename FROM images LIMIT 5`);
    console.log(`📊 Basic query works: ${allImages.length} images`);
    
    // Test the untagged query
    const untaggedImages = await databaseService.all(`
      SELECT i.* 
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      WHERE it.image_id IS NULL
      ORDER BY i.created_at DESC
    `);
    console.log(`📊 Untagged query works: ${untaggedImages.length} untagged images`);
    
    res.json({
      success: true,
      allImagesCount: allImages.length,
      untaggedCount: untaggedImages.length,
      untaggedImages: untaggedImages.slice(0, 3) // Just first 3 for brevity
    });
  } catch (error) {
    console.error('❌ Debug untagged error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Debug endpoint to check all image paths in database
app.get('/api/debug/paths', async (req, res) => {
  try {
    console.log('🔍 Debug: Checking all image paths in database');
    
    const images = await databaseService.all(`
      SELECT id, filename, dropbox_path, LENGTH(dropbox_path) as path_length
      FROM images 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    console.log(`📊 Found ${images.length} images in database`);
    images.forEach(img => {
      console.log(`📂 ID ${img.id}: ${img.filename}`);
      console.log(`   Path (${img.path_length} chars): ${img.dropbox_path}`);
    });
    
    res.json({
      success: true,
      count: images.length,
      images: images
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check what tags exist
app.get('/api/debug/tags', async (req, res) => {
  try {
    console.log('🔍 Debug: Checking all tags in database...');
    
    const allTags = await databaseService.all('SELECT * FROM tags ORDER BY name');
    const tagCounts = await databaseService.all(`
      SELECT t.name, COUNT(it.image_id) as image_count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id, t.name
      ORDER BY image_count DESC, t.name
    `);
    
    console.log(`📊 Found ${allTags.length} total tags`);
    
    // Look specifically for archier and yandoit variants
    const archierTags = allTags.filter(t => t.name.toLowerCase().includes('archier'));
    const yandoitTags = allTags.filter(t => t.name.toLowerCase().includes('yandoit'));
    
    // Check image counts - simplified to avoid SQL errors
    let archierImageCount = 0;
    let yandoitImageCount = 0;
    let bothImageCount = 0;
    let sampleBothImages = [];
    
    try {
      // Simple count queries first
      if (archierTags.length > 0) {
        const archierResult = await databaseService.all(`
          SELECT COUNT(*) as count FROM images i
          JOIN image_tags it ON i.id = it.image_id
          JOIN tags t ON it.tag_id = t.id
          WHERE LOWER(t.name) = 'archier'
        `);
        archierImageCount = archierResult[0]?.count || 0;
        
        const yandoitResult = await databaseService.all(`
          SELECT COUNT(*) as count FROM images i
          JOIN image_tags it ON i.id = it.image_id
          JOIN tags t ON it.tag_id = t.id
          WHERE LOWER(t.name) = 'yandoit'
        `);
        yandoitImageCount = yandoitResult[0]?.count || 0;
      }
    } catch (queryError) {
      console.error('Error in count queries:', queryError);
    }
    
    res.json({
      success: true,
      totalTags: allTags.length,
      archierTags: archierTags,
      yandoitTags: yandoitTags,
      topTags: tagCounts.slice(0, 20),
      allTags: allTags.map(t => t.name),
      archierImageCount: archierImageCount,
      yandoitImageCount: yandoitImageCount,
      bothImageCount: bothImageCount,
      sampleBothImages: sampleBothImages
    });
    
  } catch (error) {
    console.error('❌ Debug tags error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process metadata for a batch of specific images
app.post('/api/admin/fix-metadata-batch', async (req, res) => {
  try {
    const { imageIds } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds)) {
      return res.status(400).json({ error: 'imageIds array required' });
    }
    
    console.log(`🔧 Processing metadata for batch of ${imageIds.length} images...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const results = [];
    
    for (const imageId of imageIds) {
      try {
        // Get image from database
        const image = await databaseService.getImageById(imageId);
        if (!image) {
          errors.push(`Image ${imageId}: not found`);
          errorCount++;
          continue;
        }
        
        console.log(`📝 Processing metadata for ${image.filename}...`);
        
        // Update metadata
        await metadataService.updateImageMetadata(image.dropbox_path, {
          tags: image.tags,
          focusedTags: image.focused_tags || [],
          title: image.title || image.filename,
          description: image.description || `Tagged with: ${image.tags?.join(', ') || 'no tags'}`
        });
        
        results.push({
          id: image.id,
          filename: image.filename,
          tags: image.tags,
          status: 'success'
        });
        
        successCount++;
        console.log(`✅ Completed metadata for ${image.filename}`);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Failed to process metadata for image ${imageId}:`, error.message);
        errors.push(`Image ${imageId}: ${error.message}`);
        errorCount++;
      }
    }
    
    const message = `Metadata batch completed: ${successCount} successful, ${errorCount} errors`;
    console.log(message);
    
    res.json({
      success: true,
      message,
      stats: {
        total: imageIds.length,
        successful: successCount,
        errors: errorCount,
        errorDetails: errors,
        results: results
      }
    });
    
  } catch (error) {
    console.error('❌ Fix metadata batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fix missing yandoit and complete tags for Archier images based on folder structure
app.post('/api/admin/fix-missing-archier-tags', async (req, res) => {
  try {
    console.log('🔧 Starting to fix missing tags for Archier images...');
    
    // Get all images tagged with 'archier'
    const archierImages = await databaseService.searchImages('', ['archier']);
    console.log(`📊 Found ${archierImages.length} Archier images to check`);
    
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];
    const updates = [];
    
    for (const image of archierImages) {
      try {
        console.log(`🔍 Checking ${image.filename}...`);
        console.log(`📂 Folder path: ${image.dropbox_path}`);
        
        let currentTags = [...(image.tags || [])];
        let needsUpdate = false;
        const addedTags = [];
        
        // Check if image is in Yandoit folder and add yandoit tag
        if (image.dropbox_path.includes('/Yandoit/') && !currentTags.includes('yandoit')) {
          currentTags.push('yandoit');
          addedTags.push('yandoit');
          needsUpdate = true;
          console.log(`  ✅ Adding 'yandoit' tag`);
        }
        
        // Check if image is in Final folder and add complete tag
        if (image.dropbox_path.includes('/Final/') && !currentTags.includes('complete')) {
          currentTags.push('complete');
          addedTags.push('complete');
          needsUpdate = true;
          console.log(`  ✅ Adding 'complete' tag`);
        }
        
        if (needsUpdate) {
          // Update tags in database
          await databaseService.updateImageTags(image.id, currentTags, image.focused_tags || []);
          
          updates.push({
            id: image.id,
            filename: image.filename,
            addedTags: addedTags,
            newTags: currentTags
          });
          updatedCount++;
          console.log(`✅ Updated ${image.filename} with tags: ${currentTags.join(', ')}`);
        } else {
          console.log(`  ⏭️ No updates needed for ${image.filename}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to update tags for ${image.filename}:`, error.message);
        errors.push(`${image.filename}: ${error.message}`);
        errorCount++;
      }
    }
    
    const message = `Missing tags fix completed: ${updatedCount} updated, ${errorCount} errors`;
    console.log(message);
    
    res.json({
      success: true,
      message,
      stats: {
        total: archierImages.length,
        updated: updatedCount,
        errors: errorCount,
        errorDetails: errors,
        updates: updates
      }
    });
    
  } catch (error) {
    console.error('❌ Fix missing Archier tags error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple test: download image and try writing tags locally
app.post('/api/admin/test-local-metadata', async (req, res) => {
  try {
    const { imageId } = req.body;
    
    if (!imageId) {
      return res.status(400).json({ error: 'imageId required' });
    }
    
    console.log(`🧪 Testing local metadata writing for image: ${imageId}...`);
    
    // Get image from database
    const image = await databaseService.getImageById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const tempPath = `temp/test-${Date.now()}-${image.filename}`;
    const fs = require('fs').promises;
    
    try {
      // Ensure temp directory exists
      await fs.mkdir('temp', { recursive: true });
      
      // Download file
      console.log(`📥 Downloading ${image.filename}...`);
      await dropboxService.downloadFile(image.dropbox_path, tempPath);
      
      // Check file was downloaded
      const stats = await fs.stat(tempPath);
      console.log(`✅ Downloaded ${stats.size} bytes`);
      
      // Try writing metadata using simple exiftool command approach
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      const tags = (image.tags || []).join(',');
      console.log(`🏷️ Writing tags: ${tags}`);
      
      // Try direct exiftool command
      const exiftoolCmd = `exiftool -overwrite_original -Keywords="${tags}" -Subject="${tags}" -Creator="Archier SnapTag" "${tempPath}"`;
      console.log(`🔧 Running: ${exiftoolCmd}`);
      
      const cmdResult = await execPromise(exiftoolCmd);
      console.log(`✅ ExifTool output:`, cmdResult.stdout);
      if (cmdResult.stderr) console.log(`⚠️ ExifTool stderr:`, cmdResult.stderr);
      
      // Read back the metadata to verify
      const readCmd = `exiftool -j -Keywords -Subject -Creator "${tempPath}"`;
      const readResult = await execPromise(readCmd);
      console.log(`📖 Read back metadata:`, readResult.stdout);
      
      // Clean up
      await fs.unlink(tempPath);
      
      res.json({
        success: true,
        message: 'Local metadata test completed',
        writeOutput: cmdResult.stdout,
        readOutput: readResult.stdout,
        fileSize: stats.size,
        tagsWritten: tags
      });
      
    } catch (error) {
      console.error(`❌ Local metadata test error:`, error);
      
      // Clean up on error
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore
      }
      
      res.status(500).json({ error: error.message });
    }
    
  } catch (error) {
    console.error('❌ Test local metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test ExifTool command line availability 
app.get('/api/admin/test-exiftool-cli', async (req, res) => {
  try {
    console.log('🧪 Testing ExifTool command line availability...');
    
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      // Test if exiftool command is available
      const versionResult = await execPromise('exiftool -ver');
      console.log(`✅ ExifTool CLI version: ${versionResult.stdout.trim()}`);
      
      // Test if we can use it to read a simple file
      const helpResult = await execPromise('exiftool -h');
      console.log(`✅ ExifTool help available`);
      
      res.json({
        success: true,
        message: 'ExifTool CLI is working',
        version: versionResult.stdout.trim(),
        helpAvailable: !!helpResult.stdout
      });
      
    } catch (cliError) {
      console.error('❌ ExifTool CLI error:', cliError.message);
      res.json({
        success: false,
        error: `ExifTool CLI error: ${cliError.message}`,
        details: cliError
      });
    }
    
  } catch (error) {
    console.error('❌ ExifTool CLI test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Test ExifTool availability and basic functionality
app.get('/api/admin/test-exiftool', async (req, res) => {
  try {
    console.log('🧪 Testing ExifTool availability...');
    
    // Test if ExifTool is available
    const exiftool = require('node-exiftool');
    const ep = new exiftool.ExiftoolProcess();
    
    try {
      await ep.open();
      console.log('✅ ExifTool process opened successfully');
      
      // Test basic ExifTool functionality (version might not be available)
      console.log('🔧 ExifTool process methods:', Object.getOwnPropertyNames(ep));
      
      await ep.close();
      
      res.json({
        success: true,
        message: 'ExifTool is working',
        methods: Object.getOwnPropertyNames(ep)
      });
      
    } catch (toolError) {
      console.error('❌ ExifTool error:', toolError);
      res.json({
        success: false,
        error: `ExifTool error: ${toolError.message}`,
        details: toolError.stack
      });
    }
    
  } catch (error) {
    console.error('❌ ExifTool test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

// Test metadata embedding for one image
app.post('/api/admin/test-single-metadata', async (req, res) => {
  try {
    const { imageId } = req.body;
    
    if (!imageId) {
      return res.status(400).json({ error: 'imageId required' });
    }
    
    console.log(`🧪 Testing metadata embedding for single image: ${imageId}...`);
    
    // Get image from database
    const image = await databaseService.getImageById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    console.log(`🔍 Image: ${image.filename}`);
    console.log(`📂 Path: ${image.dropbox_path}`);
    console.log(`🏷️ Database tags: ${(image.tags || []).join(', ')}`);
    
    // Test metadata embedding
    try {
      await metadataService.updateImageMetadata(image.dropbox_path, {
        tags: image.tags,
        focusedTags: image.focused_tags || [],
        title: image.title || image.filename,
        description: image.description || `Tagged with: ${image.tags?.join(', ') || 'no tags'}`
      });
      
      // Verify by reading back
      const tempPath = `temp/verify-${Date.now()}-${image.filename}`;
      let verificationResult = {};
      
      try {
        await dropboxService.downloadFile(image.dropbox_path, tempPath);
        const readMetadata = await metadataService.readMetadata(tempPath);
        verificationResult = {
          success: true,
          embeddedTags: readMetadata.tags || [],
          creator: readMetadata.creator || '',
          rights: readMetadata.rights || ''
        };
        await require('fs').promises.unlink(tempPath);
      } catch (verifyError) {
        verificationResult = { success: false, error: verifyError.message };
        try {
          await require('fs').promises.unlink(tempPath);
        } catch (cleanupError) {
          // Ignore
        }
      }
      
      res.json({
        success: true,
        image: {
          id: image.id,
          filename: image.filename,
          databaseTags: image.tags || [],
        },
        verification: verificationResult
      });
      
    } catch (embedError) {
      console.error(`❌ Embedding failed:`, embedError.message);
      res.status(500).json({ error: `Embedding failed: ${embedError.message}` });
    }
    
  } catch (error) {
    console.error('❌ Test single metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test metadata embedding for specific images
app.post('/api/admin/test-metadata', async (req, res) => {
  try {
    const { imageIds } = req.body; // Array of image IDs to test
    
    if (!imageIds || !Array.isArray(imageIds)) {
      return res.status(400).json({ error: 'imageIds array required' });
    }
    
    console.log(`🧪 Testing metadata for ${imageIds.length} images...`);
    
    const results = [];
    
    for (const imageId of imageIds.slice(0, 3)) { // Limit to 3 for testing
      try {
        // Get image from database
        const image = await databaseService.getImageById(imageId);
        if (!image) {
          results.push({ imageId, error: 'Image not found' });
          continue;
        }
        
        console.log(`🔍 Testing metadata for ${image.filename}...`);
        
        // Download file temporarily to read metadata (since ExifTool can't read Dropbox URLs directly)
        const tempPath = `temp/verify-${Date.now()}-${image.filename}`;
        let currentMetadata = {};
        
        try {
          await dropboxService.downloadFile(image.dropbox_path, tempPath);
          currentMetadata = await metadataService.readMetadata(tempPath);
          // Clean up temp file
          await require('fs').promises.unlink(tempPath);
        } catch (metadataError) {
          console.error(`⚠️ Could not read metadata for ${image.filename}:`, metadataError.message);
          // Clean up temp file if it exists
          try {
            await require('fs').promises.unlink(tempPath);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        
        results.push({
          imageId: image.id,
          filename: image.filename,
          dropboxPath: image.dropbox_path,
          databaseTags: image.tags || [],
          embeddedTags: currentMetadata.tags || [],
          metadataMatch: JSON.stringify(image.tags?.sort()) === JSON.stringify(currentMetadata.tags?.sort()),
          currentMetadata: {
            tags: currentMetadata.tags,
            title: currentMetadata.title,
            description: currentMetadata.description,
            creator: currentMetadata.creator,
            rights: currentMetadata.rights
          }
        });
        
        console.log(`📊 ${image.filename}:`);
        console.log(`   DB Tags: ${(image.tags || []).join(', ')}`);
        console.log(`   File Tags: ${(currentMetadata.tags || []).join(', ')}`);
        console.log(`   Match: ${JSON.stringify(image.tags?.sort()) === JSON.stringify(currentMetadata.tags?.sort())}`);
        
      } catch (error) {
        console.error(`❌ Error testing metadata for image ${imageId}:`, error.message);
        results.push({ imageId, error: error.message });
      }
    }
    
    res.json({
      success: true,
      message: `Tested metadata for ${results.length} images`,
      results
    });
    
  } catch (error) {
    console.error('❌ Test metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check what tags Archier images actually have
app.get('/api/debug/archier-tags', async (req, res) => {
  try {
    console.log('🔍 Checking tags for Archier images...');
    
    // Get all images tagged with 'archier'
    const archierImages = await databaseService.searchImages('', ['archier']);
    
    const debugInfo = archierImages.map(image => ({
      id: image.id,
      filename: image.filename,
      tags: image.tags,
      tagCount: image.tags?.length || 0,
      hasYandoit: image.tags?.includes('yandoit'),
      hasComplete: image.tags?.includes('complete'),
      hasArchier: image.tags?.includes('archier'),
      dropboxPath: image.dropbox_path
    }));
    
    res.json({
      success: true,
      totalImages: archierImages.length,
      sampleImages: debugInfo.slice(0, 5), // First 5 for brevity
      allImages: debugInfo
    });
    
  } catch (error) {
    console.error('❌ Debug Archier tags error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fix metadata for existing Archier images
app.post('/api/admin/fix-archier-metadata', async (req, res) => {
  try {
    console.log('🔧 Starting metadata fix for Archier images...');
    
    // Get all images tagged with 'archier'
    const archierImages = await databaseService.searchImages('', ['archier']);
    console.log(`📊 Found ${archierImages.length} Archier images to update`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const image of archierImages) {
      try {
        console.log(`📝 Updating metadata for ${image.filename}...`);
        console.log(`🔍 Image tags:`, image.tags);
        console.log(`🔍 Tag count:`, image.tags?.length || 0);
        
        await metadataService.updateImageMetadata(image.dropbox_path, {
          tags: image.tags,
          focusedTags: image.focused_tags || [],
          title: image.title || image.filename,
          description: image.description || `Tagged with: ${image.tags?.join(', ') || 'no tags'}`
        });
        
        console.log(`✅ Updated metadata for ${image.filename} with tags: ${image.tags?.join(', ')}`);
        successCount++;
        
        // Add small delay to avoid overwhelming Dropbox API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to update metadata for ${image.filename}:`, error.message);
        errors.push(`${image.filename}: ${error.message}`);
        errorCount++;
      }
    }
    
    const message = `Metadata fix completed: ${successCount} updated, ${errorCount} errors`;
    console.log(message);
    
    res.json({
      success: true,
      message,
      stats: {
        total: archierImages.length,
        successful: successCount,
        errors: errorCount,
        errorDetails: errors
      }
    });
    
  } catch (error) {
    console.error('❌ Fix Archier metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check specific images and their tags
app.get('/api/debug/image-types', async (req, res) => {
  try {
    console.log('🔍 Debug: Checking image types and tags...');
    
    // Get all images with their tags
    const images = await databaseService.searchImages();
    
    // Focus on images that might be misclassified - show first 20
    const debugInfo = images.slice(0, 20).map(image => {
      const tags = image.tags || [];
      
      // Apply the same logic as getImageType function
      let type = 'Unknown';
      if (tags.includes('archier')) {
        type = 'Archier';
      } else if (tags.some(tag => ['materials', 'texture'].includes(tag.toLowerCase()))) {
        type = 'Texture';
      } else {
        type = 'Precedent'; // Default fallback
      }
      
      return {
        id: image.id,
        filename: image.filename,
        tags: tags,
        calculatedType: type,
        hasArchier: tags.includes('archier'),
        hasTexture: tags.some(tag => ['materials', 'texture'].includes(tag.toLowerCase())),
        hasPrecedent: tags.some(tag => tag.toLowerCase() === 'precedent'),
        hasMetal: tags.some(tag => tag.toLowerCase() === 'metal')
      };
    });

    res.json({
      success: true,
      totalImages: images.length,
      sampleImages: debugInfo
    });
  } catch (error) {
    console.error('❌ Debug image types error:', error);
    res.status(500).json({ error: error.message });
  }
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

// Simple database test endpoint
app.get('/api/debug/db-test', async (req, res) => {
  try {
    console.log('🧪 Testing database connection...');
    
    // Test basic connection
    const result = await databaseService.query('SELECT NOW() as current_time, version() as db_version');
    console.log('✅ Database connection successful');
    console.log('📊 Database info:', result.rows[0]);
    
    // Test images table
    const imageCount = await databaseService.query('SELECT COUNT(*) as count FROM images');
    console.log(`📊 Images in database: ${imageCount.rows[0].count}`);
    
    // Test specific image 18
    const image18 = await databaseService.query('SELECT id, filename, dropbox_path FROM images WHERE id = $1', [18]);
    console.log(`📊 Image 18 data:`, image18.rows[0] || 'Not found');
    
    res.json({
      success: true,
      connection: 'OK',
      database: result.rows[0],
      imageCount: imageCount.rows[0].count,
      image18: image18.rows[0] || null
    });
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    res.status(500).json({
      error: 'Database test failed',
      details: error.message,
      stack: error.stack
    });
  }
});

// Add this debug endpoint after other debug endpoints (around line 320)
app.get('/api/debug/tags-test', async (req, res) => {
  try {
    console.log('🧪 Testing getAllTags method...');
    
    // Test basic database connection
    const testQuery = await databaseService.query('SELECT NOW() as current_time');
    console.log('✅ Database connection OK:', testQuery.rows[0]);
    
    // Test tags table exists
    const tagsTest = await databaseService.query('SELECT COUNT(*) as count FROM tags');
    console.log('✅ Tags table OK, count:', tagsTest.rows[0].count);
    
    // Test image_tags table exists  
    const imageTagsTest = await databaseService.query('SELECT COUNT(*) as count FROM image_tags');
    console.log('✅ Image_tags table OK, count:', imageTagsTest.rows[0].count);
    
    // Test the actual getAllTags query step by step
    const rawTagsQuery = `
      SELECT t.id, t.name, t.color, t.created_at,
             COALESCE(COUNT(it.image_id), 0) as usage_count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id, t.name, t.color, t.created_at
      ORDER BY COALESCE(COUNT(it.image_id), 0) DESC, t.name ASC
    `;
    
    console.log('🔍 Running getAllTags query...');
    const tagsResult = await databaseService.query(rawTagsQuery);
    console.log('✅ Query result:', tagsResult.rows);
    
    // Test the getAllTags method directly
    console.log('🔍 Testing getAllTags method...');
    const allTags = await databaseService.getAllTags();
    console.log('✅ getAllTags result:', allTags);
    
    res.json({
      success: true,
      dbConnection: testQuery.rows[0],
      tagsCount: tagsTest.rows[0].count,
      imageTagsCount: imageTagsTest.rows[0].count,
      rawQueryResult: tagsResult.rows,
      getAllTagsResult: allTags
    });
    
  } catch (error) {
    console.error('❌ Tags test error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Tags test failed: ' + error.message,
      stack: error.stack
    });
  }
});

// Get all images with tags
app.get('/api/images', async (req, res) => {
  try {
    const { search, tags, limit } = req.query;
    let images = await databaseService.searchImages(search, tags);
    
    // Apply limit if specified (for extension popup)
    if (limit && !isNaN(parseInt(limit))) {
      images = images.slice(0, parseInt(limit));
      console.log(`📊 Applied limit: showing ${images.length} of total images`);
    }
    
    // Generate temporary Dropbox URLs for each image (with performance optimization)
    console.log(`🔗 Generating temporary URLs for ${images.length} images...`);
    
    // Performance optimization: if too many images, use placeholders to prevent timeout
    if (images.length > 100) {
      console.log(`⚡ Too many images (${images.length}), using placeholders to prevent timeout`);
      for (const image of images) {
        image.url = `${req.protocol}://${req.get('host')}/api/placeholder-image.jpg`;
      }
    } else {
      // For smaller sets, generate URLs in parallel for better performance
      console.log(`🚀 Generating ${images.length} URLs in parallel...`);
      const urlPromises = images.map(async (image) => {
        try {
          const url = await dropboxService.getTemporaryLink(image.dropbox_path);
          return { image, url, success: true };
        } catch (error) {
          console.error(`❌ Failed to generate URL for ${image.filename}:`, error.message);
          return { 
            image, 
            url: `${req.protocol}://${req.get('host')}/api/placeholder-image.jpg`, 
            success: false 
          };
        }
      });
      
      // Wait for all URLs to complete in parallel
      const results = await Promise.all(urlPromises);
      
      // Apply URLs to images
      results.forEach(({ image, url }) => {
        image.url = url;
      });
      
      const successCount = results.filter(r => r.success).length;
      console.log(`✅ Generated URLs: ${successCount}/${images.length} successful`);
    }
    
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get untagged images for triage (must be before /api/images/:id route)
app.get('/api/images/untagged', async (req, res) => {
  try {
    console.log('🔍 Finding untagged images for triage...');
    
    // Query for images with no tags (PostgreSQL-compatible)
    const untaggedImages = await databaseService.query(`
      SELECT i.* 
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      WHERE it.image_id IS NULL
      ORDER BY i.created_at DESC
    `);
    
    const images = untaggedImages.rows; // PostgreSQL returns .rows
    console.log(`📊 Found ${images.length} untagged images`);
    
    // Generate temporary URLs for display (with performance optimization)
    let imagesWithUrls;
    
    if (images.length > 50) {
      console.log(`⚡ Too many untagged images (${images.length}), using placeholders for speed`);
      imagesWithUrls = images.map(image => ({
        ...image,
        url: `${req.protocol}://${req.get('host')}/api/placeholder-image.jpg`,
        tags: []
      }));
    } else {
      console.log(`🚀 Generating URLs in parallel for ${images.length} untagged images...`);
      imagesWithUrls = await Promise.all(
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
              url: `${req.protocol}://${req.get('host')}/api/placeholder-image.jpg`,
              tags: []
            };
          }
        })
      );
    }
    
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
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to find untagged images: ' + error.message,
      details: error.stack
    });
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

// Get specific image by ID with detailed error logging
app.get('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Getting image by ID: ${id}`);
    
    const image = await databaseService.getImageById(id);
    if (!image) {
      console.log(`❌ Image ${id} not found in database`);
      return res.status(404).json({ error: 'Image not found' });
    }

    console.log(`📂 Found image ${id}: ${image.filename}, path: ${image.dropbox_path}`);

    // Generate temporary URL for this image
    try {
      console.log(`🔗 Generating URL for ${image.filename} at path: ${image.dropbox_path}`);
    image.url = await dropboxService.getTemporaryLink(image.dropbox_path);
      console.log(`✅ Successfully generated URL for image ${id}`);
    
    res.json(image);
    } catch (urlError) {
      console.error(`❌ Failed to generate URL for image ${id}:`, urlError.message);
      console.error(`❌ Dropbox path: ${image.dropbox_path}`);
      console.error(`❌ Full error:`, urlError);
      
      // Return image data without URL - let frontend handle placeholder
      res.json({
        ...image,
        url: null,
        error: `Failed to load image: ${urlError.message}`
      });
    }
  } catch (error) {
    console.error(`❌ Error getting image ${req.params.id}:`, error);
    console.error(`❌ Error stack:`, error.stack);
    res.status(500).json({ 
      error: 'Failed to get image',
      details: error.message,
      imageId: req.params.id
    });
  }
});

// Upload and tag image
app.post('/api/images/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { tags, title, name, description, focusedTags } = req.body;
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
      name,
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
    console.log('🌐 Extension save request received:', {
      imageUrl: req.body.imageUrl?.substring(0, 100) + '...',
      tags: req.body.tags,
      title: req.body.title,
      sourceUrl: req.body.sourceUrl?.substring(0, 100) + '...'
    });
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
    const { tags, focusedTags, title, name, description } = req.body;

    console.log(`🏷️ Updating tags for image ${id}:`, { tags, focusedTags });
    console.log('🔧 DEBUG: About to update database tags');

    // Update database first (tags and metadata)
    await databaseService.updateImageTags(id, tags, focusedTags);
    
    // Update metadata fields if provided
    if (title !== undefined || name !== undefined || description !== undefined) {
      await databaseService.query(`
        UPDATE images 
        SET title = COALESCE($1, title), 
            name = COALESCE($2, name), 
            description = COALESCE($3, description)
        WHERE id = $4
      `, [title || null, name || null, description || null, id]);
    }
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
          title: title || image.title,
          name: name || image.name,
          description: description || image.description
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
    console.log('🔍 Fetching all tags...');
    const tags = await databaseService.getAllTags();
    console.log(`✅ Found ${tags.length} tags`);
    console.log('📊 Sample tag:', tags[0]);
    res.json(tags);
  } catch (error) {
    console.error('❌ Error fetching tags:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch tags: ' + error.message,
      details: error.stack
    });
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
        let ext = path.extname(image.filename);
        
        // Fallback to .jpg if no extension found or malformed
        if (!ext || ext === '.' || ext === '') {
          ext = '.jpg';
          console.log(`⚠️ Using fallback extension .jpg for image ${image.id}: "${image.filename}"`);
        }
        
        // Check if we need to regenerate filename (only if tags changed)
        let newFilename = image.filename;
        let needsFilenameUpdate = false;
        
        // If this is a new tagging (tags were added), regenerate filename with ALL tags
        if (uniqueNewTags.length > 0) {
          // Try to get sequence number from existing filename, or get next available
          let sequenceNumber = null;
          const existingMatch = image.filename.match(/^(\d{5})-/);
          
          if (existingMatch) {
            // Preserve existing sequence number
            sequenceNumber = parseInt(existingMatch[1]);
          } else {
            // Get next sequence number for new files
            sequenceNumber = await folderPathService.getNextSequenceNumber(databaseService);
          }
          
          newFilename = folderPathService.generateTagBasedFilename(allTags, ext, sequenceNumber);
          needsFilenameUpdate = newFilename !== image.filename;
        }
        
        const newDropboxPath = path.posix.join(newFolderPath, newFilename);
        
        // Move file in Dropbox if path or filename has changed
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
        
        // Update metadata in the actual image file
        try {
          console.log(`📝 Embedding metadata in Dropbox file for image ${imageId}...`);
          await metadataService.updateImageMetadata(newDropboxPath, {
            tags: allTags,
            focusedTags: image.focused_tags || [],
            title: image.title,
            description: image.description
          });
          console.log(`✅ Metadata embedded for image ${imageId}`);
        } catch (metadataError) {
          console.error(`⚠️ Failed to embed metadata for image ${imageId} (non-critical):`, metadataError.message);
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
    
    // Generate temporary Dropbox URLs for each image (with timeout protection)
    console.log(`🔗 Generating temporary URLs for ${filteredImages.length} images...`);
    
    // Quick fallback: if too many images, just use placeholders to prevent timeout
    // Increased limit from 10 to 50 to accommodate typical project sizes
    if (filteredImages.length > 50) {
      console.log(`⚡ Too many images (${filteredImages.length}), using placeholders to prevent timeout`);
      for (const image of filteredImages) {
        image.url = `${req.protocol}://${req.get('host')}/api/placeholder-image.jpg`;
      }
    } else {
      // Try to generate URLs for smaller batches
      for (let i = 0; i < filteredImages.length; i++) {
        const image = filteredImages[i];
        try {
          console.log(`🔗 Attempting to generate URL for ${image.filename} (${i+1}/${filteredImages.length}) at path: ${image.dropbox_path}`);
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('URL generation timeout')), 3000)
          );
          
          image.url = await Promise.race([
            dropboxService.getTemporaryLink(image.dropbox_path),
            timeoutPromise
          ]);
          
          if (!image.url || image.url.length < 10) {
            console.warn(`⚠️ Generated URL seems invalid for ${image.filename}: "${image.url}"`);
            image.url = `${req.protocol}://${req.get('host')}/api/placeholder-image.jpg`;
          } else {
            console.log(`✅ Generated valid URL for ${image.filename} (${image.url.length} chars)`);
          }
          
        } catch (error) {
          console.error(`❌ Failed to generate URL for ${image.filename}:`, error.message);
          image.url = `${req.protocol}://${req.get('host')}/api/placeholder-image.jpg`; // Use absolute placeholder URL
        }
      }
    }
    
    console.log(`✅ Search completed: ${filteredImages.length} images found`);
    
    // Debug: Check what we're actually sending to frontend
    const urlStats = filteredImages.slice(0, 3).map(img => ({
      id: img.id,
      filename: img.filename,
      hasUrl: !!img.url,
      urlLength: img.url?.length || 0,
      urlStart: img.url?.substring(0, 50) || 'empty'
    }));
    console.log('🔍 Sending to frontend:', urlStats);
    
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
        let ext = path.extname(image.filename);
        
        // Fallback to .jpg if no extension found or malformed
        if (!ext || ext === '.' || ext === '') {
          ext = '.jpg';
          console.log(`⚠️ Using fallback extension .jpg for image ${image.id}: "${image.filename}"`);
        }
        
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

// Migration endpoint to reorganize all existing images to new folder structure
app.post('/api/admin/migrate-folder-structure', async (req, res) => {
  try {
    console.log('🚀 Starting folder structure migration for all existing images...');
    
    // Get all images from database
    const allImages = await databaseService.query('SELECT * FROM images ORDER BY id');
    const images = allImages.rows;
    
    console.log(`📊 Found ${images.length} images to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];
    const migratedImages = [];
    
    for (const image of images) {
      try {
        console.log(`\n🔄 Processing image ${image.id}: ${image.filename}`);
        
        // Get current tags for this image
        const imageTagsResult = await databaseService.query(`
          SELECT t.name 
          FROM tags t
          JOIN image_tags it ON t.id = it.tag_id 
          WHERE it.image_id = $1
        `, [image.id]);
        
        const currentTags = imageTagsResult.rows.map(row => row.name);
        console.log(`🏷️ Current tags:`, currentTags);
        
        if (currentTags.length === 0) {
          console.log(`⚠️ Skipping image ${image.id} - no tags found`);
          skippedCount++;
          continue;
        }
        
        // Generate new folder path and filename using new structure
        const baseDropboxFolder = serverSettings.dropboxFolder || process.env.DROPBOX_FOLDER || '/ARCHIER Team Folder/Support/Production/SnapTag';
        const normalizedBaseFolder = baseDropboxFolder.startsWith('/') ? baseDropboxFolder : `/${baseDropboxFolder}`;
        const newFolderPath = folderPathService.generateFolderPath(currentTags, normalizedBaseFolder);
        let ext = path.extname(image.filename);
        
        // Fallback to .jpg if no extension found or malformed
        if (!ext || ext === '.' || ext === '') {
          ext = '.jpg';
          console.log(`⚠️ Using fallback extension .jpg for image ${image.id}: "${image.filename}"`);
        }
        
        // Try to preserve existing sequence number or assign new one
        let sequenceNumber = null;
        const existingMatch = image.filename.match(/^(\d{5})-/);
        
        if (existingMatch) {
          // Keep existing sequence number
          sequenceNumber = parseInt(existingMatch[1]);
          console.log(`🔢 Preserving sequence number: ${sequenceNumber}`);
        } else {
          // Get next available sequence number
          sequenceNumber = await folderPathService.getNextSequenceNumber(databaseService);
          console.log(`🔢 Assigning new sequence number: ${sequenceNumber}`);
        }
        
        const newFilename = folderPathService.generateTagBasedFilename(currentTags, ext, sequenceNumber);
        const newDropboxPath = path.posix.join(newFolderPath, newFilename);
        
        console.log(`📁 Old path: ${image.dropbox_path}`);
        console.log(`📁 New path: ${newDropboxPath}`);
        
        // Only migrate if path actually changed
        if (image.dropbox_path === newDropboxPath) {
          console.log(`✅ Image ${image.id} already in correct location`);
          skippedCount++;
          continue;
        }
        
        // Move file in Dropbox
        try {
          await dropboxService.moveFile(image.dropbox_path, newDropboxPath);
          console.log(`✅ Successfully moved file in Dropbox`);
          
          // Update database with new path and filename
          await databaseService.query(
            'UPDATE images SET dropbox_path = $1, filename = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [newDropboxPath, newFilename, image.id]
          );
          
          console.log(`✅ Updated database for image ${image.id}`);
          successCount++;
          
          migratedImages.push({
            id: image.id,
            oldPath: image.dropbox_path,
            newPath: newDropboxPath,
            oldFilename: image.filename,
            newFilename: newFilename,
            tags: currentTags
          });
          
        } catch (moveError) {
          console.error(`❌ Failed to move file in Dropbox:`, moveError.message);
          
          // Check if it's a "path not found" error (file may already be moved)
          if (moveError.message.includes('path/not_found') || moveError.message.includes('not_found')) {
            console.log(`⚠️ File not found at old path, checking if it exists at new path...`);
            
            try {
              // Try to check if file exists at new location
              await dropboxService.getTemporaryLink(newDropboxPath);
              console.log(`✅ File already exists at new location, updating database only`);
              
              // Update database since file is already in correct location
              await databaseService.query(
                'UPDATE images SET dropbox_path = $1, filename = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                [newDropboxPath, newFilename, image.id]
              );
              
              successCount++;
              migratedImages.push({
                id: image.id,
                oldPath: image.dropbox_path,
                newPath: newDropboxPath,
                oldFilename: image.filename,
                newFilename: newFilename,
                tags: currentTags,
                note: 'File already at new location'
              });
              
            } catch (checkError) {
              console.error(`❌ File not found at either location:`, checkError.message);
              errors.push(`Image ${image.id} (${image.filename}): File not found at old or new location`);
              errorCount++;
            }
          } else {
            errors.push(`Image ${image.id} (${image.filename}): ${moveError.message}`);
            errorCount++;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing image ${image.id}:`, error.message);
        errors.push(`Image ${image.id}: ${error.message}`);
        errorCount++;
      }
    }
    
    const message = `Migration completed: ${successCount} migrated, ${skippedCount} skipped, ${errorCount} errors`;
    console.log(`\n🎉 ${message}`);
    
    res.json({
      success: true,
      message,
      stats: {
        total: images.length,
        migrated: successCount,
        skipped: skippedCount,
        errors: errorCount,
        errorDetails: errors,
        migratedImages: migratedImages.slice(0, 10) // Show first 10 for preview
      }
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

// Debug endpoint to test AI scan functionality
app.get('/api/debug/ai-scan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🐛 DEBUG: Testing AI scan for image ${id}...`);
    
    // Get the image
    const image = await databaseService.getImageById(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    console.log(`🐛 DEBUG: Image found - ${image.filename}`);
    console.log(`🐛 DEBUG: Dropbox path - ${image.dropbox_path}`);
    
    // Test URL generation
    let imageUrl = null;
    try {
      console.log(`🐛 DEBUG: Generating URL for AI analysis...`);
      imageUrl = await dropboxService.getTemporaryLink(image.dropbox_path);
      console.log(`🐛 DEBUG: URL generated successfully: ${imageUrl ? 'YES' : 'NO'}`);
      console.log(`🐛 DEBUG: URL starts with: ${imageUrl ? imageUrl.substring(0, 50) + '...' : 'NULL'}`);
    } catch (error) {
      console.error(`🐛 DEBUG: URL generation failed:`, error);
      return res.json({
        success: false,
        error: 'URL generation failed',
        details: error.message,
        image: { id: image.id, filename: image.filename }
      });
    }
    
    // Test OpenAI API key
    const tagSuggestionService = new TagSuggestionService();
    const hasApiKey = !!tagSuggestionService.openaiApiKey;
    console.log(`🐛 DEBUG: OpenAI API Key present: ${hasApiKey}`);
    if (hasApiKey) {
      console.log(`🐛 DEBUG: API Key starts with: ${tagSuggestionService.openaiApiKey.substring(0, 10)}...`);
    }
    
    // Test AI suggestion generation
    image.url = imageUrl;
    console.log(`🐛 DEBUG: Calling generateSuggestions...`);
    const suggestions = await tagSuggestionService.generateSuggestions(image);
    console.log(`🐛 DEBUG: Suggestions returned: ${suggestions.length}`);
    
    res.json({
      success: true,
      debug: {
        imageId: id,
        filename: image.filename,
        hasUrl: !!imageUrl,
        urlPreview: imageUrl ? imageUrl.substring(0, 50) + '...' : null,
        hasApiKey: hasApiKey,
        apiKeyPreview: hasApiKey ? tagSuggestionService.openaiApiKey.substring(0, 10) + '...' : null,
        suggestionsCount: suggestions.length,
        suggestions: suggestions
      }
    });
    
  } catch (error) {
    console.error('🐛 DEBUG: AI scan debug error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  }
});

// Get tag suggestions for an untagged image
app.get('/api/images/:id/suggestions', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🤖 Generating tag suggestions for image ${id}...`);
    
    // Get the image
    const image = await databaseService.getImageById(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Generate URL for AI analysis
    try {
      console.log(`🔗 Generating URL for AI analysis: ${image.filename}`);
      image.url = await dropboxService.getTemporaryLink(image.dropbox_path);
      console.log(`✅ URL generated for AI analysis`);
    } catch (error) {
      console.error(`❌ Failed to generate URL for AI analysis:`, error);
      // AI will skip visual analysis but still do filename/source analysis
      image.url = null;
    }
    
    // Check if image already has tags
    const tagsResult = await databaseService.query(`
      SELECT t.name 
      FROM tags t
      JOIN image_tags it ON t.id = it.tag_id 
      WHERE it.image_id = $1
    `, [id]);
    
    const existingTags = tagsResult.rows.map(row => row.name);
    console.log(`🏷️ Existing tags for image ${id}:`, existingTags);
    
    // Always generate suggestions - AI should provide additional insights beyond existing tags
    
    // Generate suggestions
    const suggestions = await tagSuggestionService.generateSuggestions(image);
    
    console.log(`✅ Generated ${suggestions.length} tag suggestions for image ${id}`);
    
    // Filter out internal filing tags and existing tags
    const internalTags = ['precedent', 'archier', 'texture', 'materials'];
    const filteredSuggestions = suggestions.filter(suggestion => 
      !internalTags.includes(suggestion.tag.toLowerCase()) &&
      !existingTags.some(existing => existing.toLowerCase() === suggestion.tag.toLowerCase())
    );

    res.json({
      success: true,
      image: {
        id: image.id,
        filename: image.filename,
        source_url: image.source_url
      },
      existingTags: existingTags,
      suggestions: filteredSuggestions,
      message: existingTags.length > 0 
        ? `Found ${filteredSuggestions.length} additional suggestions beyond existing tags`
        : `Generated ${filteredSuggestions.length} tag suggestions`
    });
    
  } catch (error) {
    console.error('❌ Error generating tag suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions: ' + error.message });
  }
});

// Get bulk tag suggestions for multiple images
app.post('/api/images/bulk-suggestions', async (req, res) => {
  try {
    const { imageIds, includeTagged = false } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds)) {
      return res.status(400).json({ error: 'Image IDs array is required' });
    }
    
    console.log(`🤖 Generating bulk tag suggestions for ${imageIds.length} images (includeTagged: ${includeTagged})...`);
    
    let targetIds = imageIds;
    
    // If includeTagged is false, filter to only untagged images (original behavior)
    if (!includeTagged) {
      const untaggedIds = [];
      for (const imageId of imageIds) {
        const tagsResult = await databaseService.query(`
          SELECT COUNT(*) as tag_count
          FROM image_tags 
          WHERE image_id = $1
        `, [imageId]);
        
        if (tagsResult.rows[0].tag_count == 0) {
          untaggedIds.push(imageId);
        }
      }
      targetIds = untaggedIds;
      console.log(`📊 Found ${untaggedIds.length} untagged images out of ${imageIds.length} requested`);
    } else {
      console.log(`📊 Generating suggestions for all ${imageIds.length} selected images (including tagged ones)`);
    }
    
    // Generate suggestions for target images
    const suggestions = await tagSuggestionService.getBulkSuggestions(targetIds);
    
    console.log(`✅ Generated bulk suggestions for ${Object.keys(suggestions).length} images`);
    
    res.json({
      success: true,
      totalRequested: imageIds.length,
      targetCount: targetIds.length,
      includeTagged: includeTagged,
      suggestions: suggestions
    });
    
  } catch (error) {
    console.error('❌ Error generating bulk suggestions:', error);
    res.status(500).json({ error: 'Failed to generate bulk suggestions: ' + error.message });
  }
});

// Apply suggested tags to an image
app.post('/api/images/:id/apply-suggestions', async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    
    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags array is required' });
    }
    
    console.log(`🏷️ Applying suggested tags to image ${id}:`, tags);
    
    // Get current image data
    const image = await databaseService.getImageById(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Apply tags using existing batch tagging logic
    await databaseService.updateImageTags(id, tags, image.focused_tags || []);
    
    // Check if folder reorganization is needed
    const baseDropboxFolder = serverSettings.dropboxFolder || process.env.DROPBOX_FOLDER || '/ARCHIER Team Folder/Support/Production/SnapTag';
    const normalizedBaseFolder = baseDropboxFolder.startsWith('/') ? baseDropboxFolder : `/${baseDropboxFolder}`;
    const newFolderPath = folderPathService.generateFolderPath(tags, normalizedBaseFolder);
    let ext = path.extname(image.filename);
    
    // Fallback to .jpg if no extension found or malformed
    if (!ext || ext === '.' || ext === '') {
      ext = '.jpg';
      console.log(`⚠️ Using fallback extension .jpg for image ${image.id}: "${image.filename}"`);
    }
    
    // Generate new filename with sequential number
    let sequenceNumber = await folderPathService.getNextSequenceNumber(databaseService);
    const newFilename = folderPathService.generateTagBasedFilename(tags, ext, sequenceNumber);
    const newDropboxPath = path.posix.join(newFolderPath, newFilename);
    
    // Move file if path changed
    if (image.dropbox_path !== newDropboxPath) {
      console.log(`📁 Moving file from: ${image.dropbox_path}`);
      console.log(`📁 Moving file to: ${newDropboxPath}`);
      
      await dropboxService.moveFile(image.dropbox_path, newDropboxPath);
      
      // Update database with new path and filename
      await databaseService.query(
        'UPDATE images SET dropbox_path = $1, filename = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [newDropboxPath, newFilename, id]
      );
    }
    
    console.log(`✅ Applied suggested tags to image ${id}`);
    
    res.json({
      success: true,
      message: `Applied ${tags.length} tags to image`,
      tags: tags,
      moved: image.dropbox_path !== newDropboxPath,
      newPath: newDropboxPath
    });
    
  } catch (error) {
    console.error('❌ Error applying suggested tags:', error);
    res.status(500).json({ error: 'Failed to apply suggested tags: ' + error.message });
  }
});

// Helper functions
async function processAndUploadImage({ filePath, originalName, tags, title, name, description, focusedTags }) {
  console.log('🏷️ Adding metadata to image...');
  
  // Check file size before processing
  const statsBefore = await fs.stat(filePath);
  console.log('📊 File size before metadata processing:', statsBefore.size, 'bytes');
  
  // Add metadata to image
  const processedImagePath = await metadataService.addMetadataToImage(filePath, {
    tags,
    title,
    name,
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
  let ext = path.extname(originalName);
  
  // Fallback to .jpg if no extension found
  if (!ext || ext === '.' || ext === '') {
    ext = '.jpg';
    console.log(`⚠️ Using fallback extension .jpg for uploaded file: "${originalName}"`);
  }
  
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
    name,
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

async function saveImageFromUrl({ imageUrl, tags, title, name, description, focusedTags, sourceUrl }) {
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
      name,
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

// Sync database filenames with actual Dropbox files
app.post('/api/admin/sync-dropbox-filenames', async (req, res) => {
  try {
    console.log('🔄 Starting database filename sync with Dropbox...');
    
    // Get all images from database
    const result = await databaseService.query('SELECT id, filename, dropbox_path FROM images ORDER BY id');
    const dbImages = result.rows;
    
    console.log(`📊 Found ${dbImages.length} images in database`);
    
    const updates = [];
    const errors = [];
    
    for (const dbImage of dbImages) {
      try {
        console.log(`🔍 Checking ${dbImage.filename}...`);
        
        // Try to get file info from Dropbox using current path
        let actualPath = dbImage.dropbox_path;
        let actualFilename = dbImage.filename;
        
        // Skip files that are already in AXXXX format and exist
        if (dbImage.filename.startsWith('A') && dbImage.filename.match(/^A\d{4}-/)) {
          try {
            await dropboxService.dbx.filesGetMetadata({ path: actualPath });
            console.log(`✅ ${dbImage.filename} already in correct AXXXX format and exists`);
            continue;
          } catch (error) {
            console.log(`❌ AXXXX file ${dbImage.filename} not found at ${actualPath} - investigating...`);
          }
        }
        
        try {
          // Check if current path exists
          await dropboxService.dbx.filesGetMetadata({ path: actualPath });
          console.log(`✅ ${dbImage.filename} exists at current path`);
          continue; // File exists, no update needed
        } catch (error) {
          console.log(`❌ ${dbImage.filename} not found at ${actualPath}`);
          
          // Try to find the file with AXXXX format
          const basePath = actualPath.substring(0, actualPath.lastIndexOf('/') + 1);
          const extension = actualPath.substring(actualPath.lastIndexOf('.'));
          
          // Extract ID from original filename 
          // Handle both AXXXX format (A0087 -> 0087) and 0XXX format (0087 -> 0087)
          let idMatch = dbImage.filename.match(/^A(\d{4})/); // AXXXX format
          if (!idMatch) {
            idMatch = dbImage.filename.match(/^(\d{4})/); // 0XXX format
          }
          if (idMatch) {
            const fileId = idMatch[1];
            let found = false;
            
            // Try to list files in the directory to see what's actually there
            try {
              const folderContents = await dropboxService.dbx.filesListFolder({ path: basePath.slice(0, -1) }); // Remove trailing slash
              const filesInFolder = folderContents.result.entries
                .filter(entry => entry['.tag'] === 'file')
                .map(entry => entry.name);
              
              console.log(`📂 Files in ${basePath}: ${filesInFolder.join(', ')}`);
              
              // Look for files that start with A${fileId}
              const matchingFiles = filesInFolder.filter(filename => filename.startsWith(`A${fileId}-`));
              
              if (matchingFiles.length > 0) {
                const newFilename = matchingFiles[0]; // Take the first match
                const newPath = basePath + newFilename;
                
                console.log(`✅ Found matching file: ${newFilename}`);
                
                // Update database
                await databaseService.query(
                  'UPDATE images SET filename = $1, dropbox_path = $2 WHERE id = $3',
                  [newFilename, newPath, dbImage.id]
                );
                
                updates.push({
                  id: dbImage.id,
                  oldFilename: dbImage.filename,
                  newFilename: newFilename,
                  oldPath: dbImage.dropbox_path,
                  newPath: newPath
                });
                
                found = true;
              }
            } catch (listError) {
              console.log(`❌ Could not list folder ${basePath}: ${listError.message}`);
            }
            
            if (!found) {
              // Try different AXXXX patterns as fallback
              const possibleFilenames = [
                `A${fileId}-precedent-general${extension}`,
                `A${fileId}-precedent-exteriors${extension}`,
                `A${fileId}-precedent-stairs${extension}`,
                `A${fileId}-texture-metal${extension}`,
                `A${fileId}-texture-wood${extension}`,
                `A${fileId}-archier-yandoit${extension}`,
                `A${fileId}-archier-complete${extension}`
              ];
            
              for (const possibleFilename of possibleFilenames) {
              const possiblePath = basePath + possibleFilename;
              try {
                await dropboxService.dbx.filesGetMetadata({ path: possiblePath });
                console.log(`✅ Found renamed file: ${possibleFilename}`);
                
                // Update database
                await databaseService.query(
                  'UPDATE images SET filename = $1, dropbox_path = $2 WHERE id = $3',
                  [possibleFilename, possiblePath, dbImage.id]
                );
                
                updates.push({
                  id: dbImage.id,
                  oldFilename: dbImage.filename,
                  newFilename: possibleFilename,
                  oldPath: dbImage.dropbox_path,
                  newPath: possiblePath
                });
                
                found = true;
                break;
              } catch (checkError) {
                // File doesn't exist with this name, try next
                continue;
                }
              }
            }
            
            if (!found) {
              console.log(`❌ Could not find any AXXXX variant for ${dbImage.filename}`);
              errors.push({
                id: dbImage.id,
                filename: dbImage.filename,
                error: 'No AXXXX variant found'
              });
            }
          } else {
            errors.push({
              id: dbImage.id,
              filename: dbImage.filename,
              error: 'Could not extract ID from filename'
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${dbImage.filename}:`, error.message);
        errors.push({
          id: dbImage.id,
          filename: dbImage.filename,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Sync complete: ${updates.length} updated, ${errors.length} errors`);
    
    res.json({
      success: true,
      message: `Synced ${updates.length} filenames with Dropbox`,
      results: {
        totalChecked: dbImages.length,
        updated: updates,
        errors: errors
      }
    });
    
  } catch (error) {
    console.error('❌ Filename sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync filenames with Dropbox', 
      details: error.message 
    });
  }
});

// Quick fix for Archier/Yandoit AXXXX filenames
app.post('/api/admin/fix-archier-filenames', async (req, res) => {
  try {
    console.log('🔄 Fixing Archier/Yandoit filenames to AXXXX format...');
    
    // Update all 0XXX-archier-yandoit.jpg files to AXXXX-archier-yandoit.jpg
    const updateQuery = `
      UPDATE images 
      SET 
        filename = 'A' || filename,
        dropbox_path = REPLACE(dropbox_path, '/' || filename, '/A' || filename)
      WHERE filename LIKE '%archier-yandoit.jpg' 
        AND filename NOT LIKE 'A%'
      RETURNING id, filename, dropbox_path
    `;
    
    const result = await databaseService.query(updateQuery);
    const updatedFiles = result.rows;
    
    console.log(`✅ Updated ${updatedFiles.length} Archier/Yandoit files`);
    
    res.json({
      success: true,
      message: `Updated ${updatedFiles.length} Archier/Yandoit filenames to AXXXX format`,
      updated: updatedFiles
    });
    
  } catch (error) {
    console.error('❌ Archier filename fix error:', error);
    res.status(500).json({ 
      error: 'Failed to fix Archier filenames', 
      details: error.message 
    });
  }
});

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

// Clean up orphaned database records (images that exist in DB but not in Dropbox)
app.post('/api/admin/cleanup-orphaned-records', async (req, res) => {
  try {
    console.log('🧹 Starting cleanup of orphaned database records...');
    
    // Get all images from database
    const allImages = await databaseService.query('SELECT id, filename, dropbox_path FROM images ORDER BY id');
    const images = allImages.rows;
    
    console.log(`📊 Checking ${images.length} database records against Dropbox...`);
    
    let foundCount = 0;
    let missingCount = 0;
    const missingImages = [];
    const cleanupErrors = [];
    
    for (const image of images) {
      try {
        // Try to check if file exists in Dropbox
        await dropboxService.getTemporaryLink(image.dropbox_path);
        foundCount++;
        console.log(`✅ Found: ${image.filename}`);
      } catch (error) {
        if (error.message.includes('path/not_found') || error.message.includes('not_found')) {
          console.log(`❌ Missing: ${image.filename} (${image.dropbox_path})`);
          missingImages.push({
            id: image.id,
            filename: image.filename,
            dropbox_path: image.dropbox_path
          });
          missingCount++;
        } else {
          // Other error (maybe network issue), don't delete
          console.log(`⚠️ Error checking ${image.filename}: ${error.message}`);
        }
      }
    }
    
    console.log(`📊 Results: ${foundCount} found, ${missingCount} missing`);
    
    // Remove orphaned records if any found
    if (missingImages.length > 0) {
      console.log(`🗑️ Removing ${missingImages.length} orphaned database records...`);
      
      for (const missingImage of missingImages) {
        try {
          // Remove image tags first
          await databaseService.query('DELETE FROM image_tags WHERE image_id = $1', [missingImage.id]);
          
          // Remove focused tags
          await databaseService.query('DELETE FROM focused_tags WHERE image_id = $1', [missingImage.id]);
          
          // Remove image record
          await databaseService.query('DELETE FROM images WHERE id = $1', [missingImage.id]);
          
          console.log(`🗑️ Removed orphaned record: ${missingImage.filename}`);
        } catch (deleteError) {
          console.error(`❌ Failed to delete record ${missingImage.id}:`, deleteError.message);
          cleanupErrors.push(`Failed to delete ${missingImage.filename}: ${deleteError.message}`);
        }
      }
    }
    
    const message = `Cleanup completed: ${foundCount} valid files, ${missingCount} orphaned records removed`;
    console.log(`✅ ${message}`);
    
    res.json({
      success: true,
      message,
      stats: {
        total: images.length,
        found: foundCount,
        missing: missingCount,
        removed: missingImages.length,
        errors: cleanupErrors.length,
        errorDetails: cleanupErrors,
        removedFiles: missingImages.map(img => img.filename)
      }
    });
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed: ' + error.message });
  }
});

// Cleanup and normalize existing tags
app.post('/api/admin/normalise-tags', async (req, res) => {
  try {
    console.log('🏷️ Starting tag normalization process...');
    
    // Get all existing tags
    const allTags = await databaseService.query('SELECT id, name FROM tags ORDER BY created_at ASC');
    const tags = allTags.rows;
    
    console.log(`📊 Found ${tags.length} tags to normalize`);
    
    const tagMap = new Map(); // normalized_name -> {id, original_name, duplicates: []}
    const duplicateTags = [];
    
    // Group tags by normalized name
    tags.forEach(tag => {
      const normalizedName = tag.name.toLowerCase().trim();
      
      if (tagMap.has(normalizedName)) {
        // This is a duplicate
        tagMap.get(normalizedName).duplicates.push(tag);
        duplicateTags.push(tag);
      } else {
        // First occurrence
        tagMap.set(normalizedName, {
          id: tag.id,
          originalName: tag.name,
          normalizedName: normalizedName,
          duplicates: []
        });
      }
    });
    
    console.log(`📊 Found ${duplicateTags.length} duplicate tags to merge`);
    
    let mergedCount = 0;
    let updatedCount = 0;
    
    // Process each tag group
    for (const [normalizedName, tagGroup] of tagMap) {
      try {
        // Update the main tag to use normalized name
        if (tagGroup.originalName !== normalizedName) {
          await databaseService.query(
            'UPDATE tags SET name = $1 WHERE id = $2',
            [normalizedName, tagGroup.id]
          );
          console.log(`📝 Updated tag "${tagGroup.originalName}" -> "${normalizedName}"`);
          updatedCount++;
        }
        
        // Merge duplicates into the main tag
        for (const duplicateTag of tagGroup.duplicates) {
          console.log(`🔄 Merging duplicate "${duplicateTag.name}" into "${normalizedName}"`);
          
          // Move all image_tags references from duplicate to main tag
          await databaseService.query(`
            UPDATE image_tags 
            SET tag_id = $1 
            WHERE tag_id = $2 
            AND NOT EXISTS (
              SELECT 1 FROM image_tags it2 
              WHERE it2.image_id = image_tags.image_id 
              AND it2.tag_id = $1
            )
          `, [tagGroup.id, duplicateTag.id]);
          
          // Delete duplicate image_tags that would create conflicts
          await databaseService.query(`
            DELETE FROM image_tags 
            WHERE tag_id = $1 
            AND EXISTS (
              SELECT 1 FROM image_tags it2 
              WHERE it2.image_id = image_tags.image_id 
              AND it2.tag_id = $2
            )
          `, [duplicateTag.id, tagGroup.id]);
          
          // Delete the duplicate tag
          await databaseService.query('DELETE FROM tags WHERE id = $1', [duplicateTag.id]);
          
          mergedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing tag group "${normalizedName}":`, error);
      }
    }
    
    console.log(`✅ Tag normalization complete: ${updatedCount} updated, ${mergedCount} merged`);
    
    res.json({
      success: true,
      message: `Tag normalization complete: ${updatedCount} tags updated to lowercase, ${mergedCount} duplicates merged`,
      stats: {
        totalTags: tags.length,
        duplicatesFound: duplicateTags.length,
        tagsUpdated: updatedCount,
        tagsMerged: mergedCount,
        finalTagCount: tags.length - mergedCount
      }
    });
    
  } catch (error) {
    console.error('❌ Tag normalization error:', error);
    res.status(500).json({ error: 'Tag normalization failed: ' + error.message });
  }
});

// Scan for visual duplicates
app.post('/api/admin/scan-visual-duplicates', async (req, res) => {
  try {
    console.log('🔍 Starting visual duplicate scan...');
    
    const { similarityThreshold = 5, autoRemove = false } = req.body;
    
    const result = await duplicateDetectionService.scanForVisualDuplicates(similarityThreshold);
    
    if (autoRemove && result.duplicateGroups.length > 0) {
      console.log('🗑️ Auto-removing visual duplicates...');
      const removeResult = await duplicateDetectionService.removeDuplicates(result.duplicateGroups);
      result.stats.removed = removeResult.removed;
      result.stats.removeErrors = removeResult.errors;
    }
    
    res.json({
      success: true,
      message: `Visual duplicate scan completed: ${result.stats.duplicateGroups} groups found with ${result.stats.duplicateImages} duplicate images`,
      stats: result.stats,
      duplicateGroups: result.duplicateGroups
    });
    
  } catch (error) {
    console.error('❌ Visual duplicate scan error:', error);
    res.status(500).json({ error: 'Visual duplicate scan failed: ' + error.message });
  }
});

// Remove specific visual duplicates
app.post('/api/admin/remove-visual-duplicates', async (req, res) => {
  try {
    console.log('🗑️ Removing selected visual duplicates...');
    
    const { duplicateGroups } = req.body;
    
    if (!duplicateGroups || !Array.isArray(duplicateGroups)) {
      return res.status(400).json({ error: 'duplicateGroups array is required' });
    }
    
    const result = await duplicateDetectionService.removeDuplicates(duplicateGroups);
    
    res.json({
      success: true,
      message: `Removed ${result.removed} visual duplicates`,
      stats: {
        removed: result.removed,
        errors: result.errors
      }
    });
    
  } catch (error) {
    console.error('❌ Visual duplicate removal error:', error);
    res.status(500).json({ error: 'Visual duplicate removal failed: ' + error.message });
  }
});

// Re-embed metadata for all images (fix metadata lost during migration)
app.post('/api/admin/re-embed-metadata', async (req, res) => {
  try {
    console.log('📝 Starting metadata re-embedding for all images...');
    
    // Get all images from database
    const allImages = await databaseService.query(`
      SELECT i.id, i.filename, i.dropbox_path, 
             STRING_AGG(DISTINCT t.name, ',') AS tag_names
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN tags t ON it.tag_id = t.id
      GROUP BY i.id, i.filename, i.dropbox_path
      ORDER BY i.id
    `);
    const images = allImages.rows;
    
    console.log(`📊 Found ${images.length} images to update metadata`);
    
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const image of images) {
      try {
        console.log(`📝 Updating metadata for: ${image.filename}`);
        
        const tags = image.tag_names ? image.tag_names.split(',') : [];
        console.log(`🏷️ Tags to embed: ${tags.join(', ')}`);
        
        if (tags.length === 0) {
          console.log(`⚠️ Skipping ${image.filename} - no tags to embed`);
          continue;
        }
        
        // Get focused tags for this image
        const focusedTagsResult = await databaseService.query(`
          SELECT tag_name, x_coordinate, y_coordinate, width, height
          FROM focused_tags 
          WHERE image_id = $1
        `, [image.id]);
        
        const focusedTags = focusedTagsResult.rows;
        
        // Update metadata
        await metadataService.updateImageMetadata(image.dropbox_path, {
          tags: tags,
          focusedTags: focusedTags,
          title: image.filename,
          description: `Tagged with: ${tags.join(', ')}`
        });
        
        console.log(`✅ Updated metadata for ${image.filename}`);
        updatedCount++;
        
        // Add small delay to avoid overwhelming Dropbox API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Failed to update metadata for ${image.filename}:`, error.message);
        errors.push(`${image.filename}: ${error.message}`);
        errorCount++;
      }
    }
    
    const message = `Metadata re-embedding completed: ${updatedCount} updated, ${errorCount} errors`;
    console.log(`✅ ${message}`);
    
    res.json({
      success: true,
      message,
      stats: {
        total: images.length,
        updated: updatedCount,
        errors: errorCount,
        errorDetails: errors
      }
    });
    
  } catch (error) {
    console.error('❌ Metadata re-embedding error:', error);
    res.status(500).json({ error: 'Metadata re-embedding failed: ' + error.message });
  }
});

// Rename tag and update all associated images
app.put('/api/tags/:tagId/rename', async (req, res) => {
  try {
    const { tagId } = req.params;
    const { newName } = req.body;
    
    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New tag name is required' });
    }
    
    const trimmedNewName = newName.trim().toLowerCase();
    console.log(`🏷️ Renaming tag ${tagId} to "${trimmedNewName}"`);
    
    // Get the current tag
    const currentTagResult = await databaseService.query('SELECT * FROM tags WHERE id = $1', [tagId]);
    if (currentTagResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    const currentTag = currentTagResult.rows[0];
    const oldName = currentTag.name;
    
    console.log(`📝 Renaming "${oldName}" to "${trimmedNewName}"`);
    
    // Check if new tag name already exists
    const existingTagResult = await databaseService.query('SELECT id FROM tags WHERE LOWER(name) = $1 AND id != $2', [trimmedNewName, tagId]);
    if (existingTagResult.rows.length > 0) {
      return res.status(409).json({ error: `Tag "${trimmedNewName}" already exists` });
    }
    
    // Update the tag name
    await databaseService.query('UPDATE tags SET name = $1 WHERE id = $2', [trimmedNewName, tagId]);
    
    // Get all images that use this tag
    const imagesWithTagResult = await databaseService.query(`
      SELECT DISTINCT i.id, i.filename, i.dropbox_path,
             STRING_AGG(DISTINCT t.name, ',') AS all_tags
      FROM images i
      JOIN image_tags it ON i.id = it.image_id
      JOIN tags t ON it.tag_id = t.id
      WHERE i.id IN (
        SELECT DISTINCT i2.id 
        FROM images i2 
        JOIN image_tags it2 ON i2.id = it2.image_id 
        WHERE it2.tag_id = $1
      )
      GROUP BY i.id, i.filename, i.dropbox_path
    `, [tagId]);
    
    const affectedImages = imagesWithTagResult.rows;
    console.log(`📊 Found ${affectedImages.length} images using this tag`);
    
    // Update metadata for each affected image
    let metadataUpdatedCount = 0;
    const metadataErrors = [];
    
    for (const image of affectedImages) {
      try {
        // Get updated tags list (replace old name with new name)
        const currentTags = image.all_tags.split(',');
        const updatedTags = currentTags.map(tag => tag === oldName ? trimmedNewName : tag);
        
        console.log(`📝 Updating metadata for ${image.filename}`);
        
        // Get focused tags for this image
        const focusedTagsResult = await databaseService.query(`
          SELECT tag_name, x_coordinate, y_coordinate, width, height
          FROM focused_tags 
          WHERE image_id = $1
        `, [image.id]);
        
        const focusedTags = focusedTagsResult.rows;
        
        // Update file metadata in Dropbox
        await metadataService.updateImageMetadata(image.dropbox_path, {
          tags: updatedTags,
          focusedTags: focusedTags,
          title: image.filename,
          description: `Tagged with: ${updatedTags.join(', ')}`
        });
        
        metadataUpdatedCount++;
        console.log(`✅ Updated metadata for ${image.filename}`);
        
      } catch (metadataError) {
        console.error(`❌ Failed to update metadata for ${image.filename}:`, metadataError.message);
        metadataErrors.push(`${image.filename}: ${metadataError.message}`);
      }
    }
    
    const message = `Tag renamed from "${oldName}" to "${trimmedNewName}"`;
    console.log(`✅ ${message}`);
    console.log(`📊 Updated metadata for ${metadataUpdatedCount}/${affectedImages.length} images`);
    
    res.json({
      success: true,
      message,
      stats: {
        oldName,
        newName: trimmedNewName,
        affectedImages: affectedImages.length,
        metadataUpdated: metadataUpdatedCount,
        metadataErrors: metadataErrors.length,
        metadataErrorDetails: metadataErrors
      }
    });
    
  } catch (error) {
    console.error('❌ Tag rename error:', error);
    res.status(500).json({ error: 'Tag rename failed: ' + error.message });
  }
});

// Fix Dropbox paths and filenames after manual folder rename
app.post('/api/admin/fix-dropbox-paths', async (req, res) => {
  try {
    console.log('🔄 Starting comprehensive path and filename fixes...');
    
    // Fix double dots in filenames (..jpg -> .jpg)
    const doubleDotsResult = await databaseService.query(`
      UPDATE images 
      SET 
        filename = REPLACE(filename, '..jpg', '.jpg'),
        dropbox_path = REPLACE(dropbox_path, '..jpg', '.jpg')
      WHERE filename LIKE '%..jpg'
    `);
    
    console.log(`✅ Fixed ${doubleDotsResult.rowCount} files with double dots`);
    
    // Update Precedents -> Precedent
    const precedentsResult = await databaseService.query(`
      UPDATE images 
      SET dropbox_path = REPLACE(dropbox_path, '/SnapTag/Precedents/', '/SnapTag/Precedent/')
      WHERE dropbox_path LIKE '%/SnapTag/Precedents/%'
    `);
    
    console.log(`✅ Updated ${precedentsResult.rowCount} files: Precedents → Precedent`);
    
    // Update Materials -> Texture
    const materialsResult = await databaseService.query(`
      UPDATE images 
      SET dropbox_path = REPLACE(dropbox_path, '/SnapTag/Materials/', '/SnapTag/Texture/')
      WHERE dropbox_path LIKE '%/SnapTag/Materials/%'
    `);
    
    console.log(`✅ Updated ${materialsResult.rowCount} files: Materials → Texture`);
    
    // Fix missing file extensions (add .jpg to files ending with just a dot)
    const extensionResult = await databaseService.query(`
      UPDATE images 
      SET 
        dropbox_path = REPLACE(dropbox_path, filename, filename || 'jpg'),
        filename = filename || 'jpg'
      WHERE filename LIKE '%.' AND filename NOT LIKE '%.jpg'
    `);
    
    console.log(`✅ Fixed ${extensionResult.rowCount} files with missing extensions`);
    
    // Get some examples of updated paths
    const sampleResult = await databaseService.query(`
      SELECT filename, dropbox_path 
      FROM images 
      WHERE dropbox_path LIKE '%/SnapTag/Precedent/%' OR dropbox_path LIKE '%/SnapTag/Texture/%'
      LIMIT 5
    `);
    
    console.log('📋 Sample updated paths:');
    sampleResult.rows.forEach(row => {
      console.log(`  ${row.filename} → ${row.dropbox_path}`);
    });
    
    res.json({
      success: true,
      message: 'Dropbox paths and filenames fixed successfully',
      stats: {
        doubleDotsFixed: doubleDotsResult.rowCount || 0,
        precedentsUpdated: precedentsResult.rowCount || 0,
        materialsUpdated: materialsResult.rowCount || 0,
        extensionsFixed: extensionResult.rowCount || 0,
        samplePaths: sampleResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Error fixing paths and filenames:', error);
    res.status(500).json({ error: 'Failed to fix paths and filenames: ' + error.message });
  }
});

// Add name column to images table if it doesn't exist
app.post('/api/admin/add-name-column', async (req, res) => {
  try {
    console.log('🔧 Adding name column to images table...');
    
    // Check if column exists
    const checkResult = await databaseService.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'images' AND column_name = 'name'
    `);
    
    if (checkResult.rows.length === 0) {
      // Add the column
      await databaseService.query('ALTER TABLE images ADD COLUMN name TEXT');
      console.log('✅ Added name column to images table');
      res.json({ success: true, message: 'Name column added successfully' });
    } else {
      console.log('✅ Name column already exists');
      res.json({ success: true, message: 'Name column already exists' });
    }
    
  } catch (error) {
    console.error('❌ Error adding name column:', error);
    res.status(500).json({ error: 'Failed to add name column: ' + error.message });
  }
});

// Professional Workflow API Endpoints
app.post('/api/workflow/batch-analyse', async (req, res) => {
  try {
    const { workflow = 'both', imageIds } = req.body;
    
    console.log(`🔬 Starting batch workflow analysis: ${workflow}`);
    
    // Get images to analyze
    let images;
    if (imageIds && imageIds.length > 0) {
      // Analyze specific images
      const placeholders = imageIds.map((_, index) => `$${index + 1}`).join(',');
      const result = await databaseService.query(`
        SELECT * FROM images WHERE id IN (${placeholders})
      `, imageIds);
      images = result.rows;
    } else {
      // Analyze all images
      const result = await databaseService.query('SELECT * FROM images ORDER BY created_at DESC');
      images = result.rows;
    }
    
    console.log(`📊 Analyzing ${images.length} images for ${workflow} workflow`);
    
    const analysis = {
      readyForInDesign: 0,
      readyForArchiCAD: 0,
      needsOptimization: 0,
      issues: []
    };
    
    const analyses = []; // Detailed per-image analyses for frontend
    
    for (const image of images) {
      // Mock analysis logic - in a real implementation, you'd analyze file properties
      const isHighRes = image.file_size > 500000; // > 500KB
      const hasProperExtension = image.filename?.toLowerCase().match(/\.(jpg|jpeg|png|tiff|tif)$/);
      
      const imageAnalysis = {
        id: image.id,
        filename: image.filename,
        fileSize: image.file_size,
        indesign: null,
        archicad: null
      };
      
      if (workflow === 'indesign' || workflow === 'both') {
        const readyForInDesign = isHighRes && hasProperExtension;
        imageAnalysis.indesign = {
          readyForProduction: readyForInDesign,
          fileSize: image.file_size,
          resolution: isHighRes ? 'High' : 'Low',
          format: hasProperExtension ? 'Supported' : 'Unsupported',
          recommendations: readyForInDesign ? [] : [
            !isHighRes ? 'Increase resolution for print quality' : null,
            !hasProperExtension ? 'Convert to supported format (JPG, PNG, TIFF)' : null
          ].filter(Boolean)
        };
        
        if (readyForInDesign) {
          analysis.readyForInDesign++;
        } else {
          analysis.needsOptimization++;
          analysis.issues.push({
            imageId: image.id,
            filename: image.filename,
            issue: !isHighRes ? 'Low resolution for print' : 'Unsupported format for InDesign'
          });
        }
      }
      
      if (workflow === 'archicad' || workflow === 'both') {
        const readyForArchiCAD = hasProperExtension;
        imageAnalysis.archicad = {
          readyForProduction: readyForArchiCAD,
          fileSize: image.file_size,
          format: hasProperExtension ? 'Supported' : 'Unsupported',
          recommendations: readyForArchiCAD ? [] : [
            'Convert to supported format (JPG, PNG, TIFF)'
          ]
        };
        
        if (readyForArchiCAD) {
          analysis.readyForArchiCAD++;
        } else {
          analysis.needsOptimization++;
          analysis.issues.push({
            imageId: image.id,
            filename: image.filename,
            issue: 'Unsupported format for ArchiCAD'
          });
        }
      }
      
      analyses.push(imageAnalysis);
    }
    
    const report = {
      success: true,
      workflow,
      summary: {
        totalAnalyzed: images.length,
        timestamp: new Date().toISOString()
      },
      report: analysis,
      analyses: analyses // Add detailed per-image analyses
    };
    
    console.log(`✅ Batch analysis complete: ${analysis.readyForInDesign} InDesign ready, ${analysis.readyForArchiCAD} ArchiCAD ready`);
    
    res.json(report);
    
  } catch (error) {
    console.error('❌ Batch workflow analysis error:', error);
    res.status(500).json({ error: 'Batch analysis failed: ' + error.message });
  }
});

app.post('/api/workflow/analyse-indesign/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await databaseService.query('SELECT * FROM images WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const image = result.rows[0];
    
    // Mock InDesign analysis
    const analysis = {
      workflow: 'indesign',
      imageId: id,
      filename: image.filename,
      ready: image.file_size > 500000 && image.filename?.toLowerCase().match(/\.(jpg|jpeg|tiff|tif)$/),
      recommendations: [
        'Ensure 300 DPI for print quality',
        'Convert to CMYK color space',
        'Use TIFF format for best quality'
      ]
    };
    
    res.json(analysis);
    
  } catch (error) {
    console.error('❌ InDesign analysis error:', error);
    res.status(500).json({ error: 'InDesign analysis failed: ' + error.message });
  }
});

app.post('/api/workflow/analyse-archicad/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await databaseService.query('SELECT * FROM images WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const image = result.rows[0];
    
    // Mock ArchiCAD analysis
    const analysis = {
      workflow: 'archicad',
      imageId: id,
      filename: image.filename,
      ready: image.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/),
      recommendations: [
        'Keep dimensions under 2048px',
        'Use power-of-2 sizing when possible',
        'Optimise file size for 3D performance'
      ]
    };
    
    res.json(analysis);
    
  } catch (error) {
    console.error('❌ ArchiCAD analysis error:', error);
    res.status(500).json({ error: 'ArchiCAD analysis failed: ' + error.message });
  }
});

// Fix long dropbox paths to simplified format
app.post('/api/admin/fix-long-paths', async (req, res) => {
  try {
    console.log('🔄 Fixing long Dropbox paths to simplified format...');
    
    // Update all paths from long format to simplified format
    const updateResult = await databaseService.query(`
      UPDATE images 
      SET dropbox_path = REPLACE(dropbox_path, '/ARCHIER Team Folder/Support/Production/SnapTag/', '/SnapTag/')
      WHERE dropbox_path LIKE '/ARCHIER Team Folder/Support/Production/SnapTag/%'
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount || 0} image paths`);
    
    // Get a sample of updated paths for verification
    const sampleResult = await databaseService.query(`
      SELECT filename, dropbox_path 
      FROM images 
      WHERE dropbox_path LIKE '/SnapTag/%' 
      LIMIT 10
    `);
    
    res.json({
      success: true,
      message: 'Long Dropbox paths fixed successfully',
      stats: {
        pathsUpdated: updateResult.rowCount || 0,
        samplePaths: sampleResult.rows
      }
    });
  } catch (error) {
    console.error('Error fixing long paths:', error);
    res.status(500).json({ error: 'Failed to fix long paths' });
  }
});

// Fix old tag-based filenames
app.post('/api/admin/fix-tag-filenames', async (req, res) => {
  try {
    console.log('🔄 Fixing old tag-based filenames...');
    
    // Fix materials -> texture in filenames and paths
    const materialsResult = await databaseService.query(`
      UPDATE images 
      SET 
        filename = REPLACE(filename, '-materials-', '-texture-'),
        dropbox_path = REPLACE(dropbox_path, REPLACE(filename, '-materials-', '-texture-'), filename)
      WHERE filename LIKE '%-materials-%'
    `);
    
    // Fix precedents -> precedent in filenames and paths  
    const precedentsResult = await databaseService.query(`
      UPDATE images 
      SET 
        filename = REPLACE(filename, '-precedents-', '-precedent-'),
        dropbox_path = REPLACE(dropbox_path, REPLACE(filename, '-precedents-', '-precedent-'), filename)
      WHERE filename LIKE '%-precedents-%'
    `);
    
    console.log(`✅ Fixed ${materialsResult.rowCount || 0} materials filenames`);
    console.log(`✅ Fixed ${precedentsResult.rowCount || 0} precedents filenames`);
    
    // Get a sample of updated filenames
    const sampleResult = await databaseService.query(`
      SELECT filename, dropbox_path 
      FROM images 
      WHERE filename LIKE '%-texture-%' OR filename LIKE '%-precedent-%'
      LIMIT 10
    `);
    
    res.json({
      success: true,
      message: 'Tag-based filenames fixed successfully',
      stats: {
        materialsFixed: materialsResult.rowCount || 0,
        precedentsFixed: precedentsResult.rowCount || 0,
        sampleFilenames: sampleResult.rows
      }
    });
  } catch (error) {
    console.error('Error fixing tag filenames:', error);
    res.status(500).json({ error: 'Failed to fix tag filenames' });
  }
});

// Check and fix server Dropbox folder setting
app.post('/api/admin/fix-server-settings', async (req, res) => {
  try {
    console.log('🔄 Checking server Dropbox folder settings...');
    console.log('Current serverSettings.dropboxFolder:', serverSettings.dropboxFolder);
    console.log('Current process.env.DROPBOX_FOLDER:', process.env.DROPBOX_FOLDER);
    
    // Update server settings to use simplified path
    const oldSetting = serverSettings.dropboxFolder;
    serverSettings.dropboxFolder = '/SnapTag';
    
    console.log('✅ Updated server Dropbox folder setting');
    console.log('Old setting:', oldSetting);
    console.log('New setting:', serverSettings.dropboxFolder);
    
    // Test generating a temporary link for verification
    const testImage = await databaseService.query('SELECT * FROM images LIMIT 1');
    let testUrl = null;
    if (testImage.rows.length > 0) {
      try {
        testUrl = await dropboxService.getTemporaryLink(testImage.rows[0].dropbox_path);
        console.log('✅ Test URL generation successful');
      } catch (error) {
        console.log('❌ Test URL generation failed:', error.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Server settings updated successfully',
      settings: {
        oldDropboxFolder: oldSetting,
        newDropboxFolder: serverSettings.dropboxFolder,
        testUrlGenerated: !!testUrl,
        testPath: testImage.rows[0]?.dropbox_path
      }
    });
  } catch (error) {
    console.error('Error fixing server settings:', error);
    res.status(500).json({ error: 'Failed to fix server settings' });
  }
});

// Verify which files exist in Dropbox vs database
app.post('/api/admin/verify-dropbox-files', async (req, res) => {
  try {
    console.log('🔍 Verifying which files exist in Dropbox...');
    
    // Get all images from database
    const allImages = await databaseService.query('SELECT id, filename, dropbox_path FROM images ORDER BY id');
    
    const results = {
      total: allImages.rows.length,
      existing: [],
      missing: [],
      errors: []
    };
    
    // Check each file in Dropbox (limit to first 10 for testing)
    for (const image of allImages.rows.slice(0, 10)) {
      try {
        console.log(`Checking: ${image.dropbox_path}`);
        
        // Try to get file metadata from Dropbox
        await dropboxService.dbx.filesGetMetadata({ path: image.dropbox_path });
        const fileExists = true;
        
        if (fileExists) {
          results.existing.push({
            id: image.id,
            filename: image.filename,
            path: image.dropbox_path,
            status: 'exists'
          });
        } else {
          results.missing.push({
            id: image.id,
            filename: image.filename,
            path: image.dropbox_path,
            status: 'missing'
          });
        }
      } catch (error) {
        results.errors.push({
          id: image.id,
          filename: image.filename,
          path: image.dropbox_path,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Verification complete: ${results.existing.length} exist, ${results.missing.length} missing, ${results.errors.length} errors`);
    
    res.json({
      success: true,
      message: 'Dropbox file verification complete',
      results
    });
  } catch (error) {
    console.error('Error verifying Dropbox files:', error);
    res.status(500).json({ error: 'Failed to verify Dropbox files' });
  }
});

// Revert server setting to correct Dropbox path
app.post('/api/admin/revert-server-settings', async (req, res) => {
  try {
    console.log('🔄 Reverting server Dropbox folder setting to correct path...');
    
    const oldSetting = serverSettings.dropboxFolder;
    serverSettings.dropboxFolder = '/ARCHIER Team Folder/Support/Production/SnapTag';
    
    console.log('✅ Reverted server Dropbox folder setting');
    console.log('Previous (incorrect) setting:', oldSetting);
    console.log('Correct setting:', serverSettings.dropboxFolder);
    
    res.json({
      success: true,
      message: 'Server settings reverted to correct path',
      settings: {
        previousSetting: oldSetting,
        correctSetting: serverSettings.dropboxFolder
      }
    });
  } catch (error) {
    console.error('Error reverting server settings:', error);
    res.status(500).json({ error: 'Failed to revert server settings' });
  }
});

// Revert database paths to match actual Dropbox structure
app.post('/api/admin/revert-database-paths', async (req, res) => {
  try {
    console.log('🔄 Reverting database paths to match actual Dropbox structure...');
    
    // Revert paths from simplified format back to long format
    const updateResult = await databaseService.query(`
      UPDATE images 
      SET dropbox_path = REPLACE(dropbox_path, '/SnapTag/', '/ARCHIER Team Folder/Support/Production/SnapTag/')
      WHERE dropbox_path LIKE '/SnapTag/%'
    `);
    
    console.log(`✅ Reverted ${updateResult.rowCount || 0} image paths`);
    
    // Get a sample of reverted paths for verification
    const sampleResult = await databaseService.query(`
      SELECT filename, dropbox_path 
      FROM images 
      WHERE dropbox_path LIKE '/ARCHIER Team Folder/Support/Production/SnapTag/%' 
      LIMIT 10
    `);
    
    res.json({
      success: true,
      message: 'Database paths reverted to match Dropbox structure',
      stats: {
        pathsReverted: updateResult.rowCount || 0,
        samplePaths: sampleResult.rows
      }
    });
  } catch (error) {
    console.error('Error reverting database paths:', error);
    res.status(500).json({ error: 'Failed to revert database paths' });
  }
});

// Migrate misplaced images to correct folders using fixed logic
app.post('/api/admin/migrate-misplaced-images', async (req, res) => {
  try {
    console.log('🔄 Migrating misplaced images using corrected folder logic...');
    
    // Get all images with their tags from database
    const allImages = await databaseService.query(`
      SELECT i.id, i.filename, i.dropbox_path, 
             COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), ARRAY[]::text[]) as tags
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN tags t ON it.tag_id = t.id
      GROUP BY i.id, i.filename, i.dropbox_path
      ORDER BY i.id
    `);
    
    const results = {
      total: allImages.rows.length,
      toMigrate: [],
      errors: [],
      skipped: []
    };
    
    for (const image of allImages.rows) {
      try {
        // Get tags array
        const tags = image.tags || [];
        console.log(`\n📋 Processing ${image.filename} with tags:`, tags);
        
        // Generate correct folder path using fixed logic
        const baseFolder = serverSettings.dropboxFolder || '/ARCHIER Team Folder/Support/Production/SnapTag';
        const correctPath = folderPathService.generateFolderPath(tags, baseFolder);
        const correctFullPath = `${correctPath}/${image.filename}`;
        
        console.log(`   Current path: ${image.dropbox_path}`);
        console.log(`   Correct path: ${correctFullPath}`);
        
        // Check if image needs to be moved
        if (image.dropbox_path !== correctFullPath) {
          console.log(`   ✅ NEEDS MIGRATION: ${image.filename}`);
          results.toMigrate.push({
            id: image.id,
            filename: image.filename,
            tags: tags,
            currentPath: image.dropbox_path,
            correctPath: correctFullPath,
            reason: 'Path mismatch with corrected folder logic'
          });
        } else {
          console.log(`   ✓ Already in correct location`);
          results.skipped.push({
            id: image.id,
            filename: image.filename,
            reason: 'Already in correct location'
          });
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${image.filename}:`, error);
        results.errors.push({
          id: image.id,
          filename: image.filename,
          error: error.message
        });
      }
    }
    
    console.log(`\n📊 Migration analysis complete:`);
    console.log(`   Total images: ${results.total}`);
    console.log(`   Need migration: ${results.toMigrate.length}`);
    console.log(`   Already correct: ${results.skipped.length}`);
    console.log(`   Errors: ${results.errors.length}`);
    
    res.json({
      success: true,
      message: 'Migration analysis complete',
      results
    });
  } catch (error) {
    console.error('Error analyzing misplaced images:', error);
    res.status(500).json({ error: 'Failed to analyse misplaced images', details: error.message });
  }
});

// Fix specific misplaced precedent+metal images
app.post('/api/admin/fix-precedent-metal-images', async (req, res) => {
  try {
    console.log('🔄 Fixing precedent+metal images misplaced in Texture/Metal...');
    
    // Find images that are tagged with both 'precedent' and 'metal' but NO 'texture' tag
    const misplacedImages = await databaseService.query(`
      SELECT DISTINCT i.id, i.filename, i.dropbox_path,
             array_agg(DISTINCT t.name) as tags
      FROM images i
      JOIN image_tags it ON i.id = it.image_id
      JOIN tags t ON it.tag_id = t.id
      WHERE i.dropbox_path LIKE '%/Texture/Metal/%'
      GROUP BY i.id, i.filename, i.dropbox_path
      HAVING 
        'precedent' = ANY(array_agg(DISTINCT t.name)) 
        AND 'metal' = ANY(array_agg(DISTINCT t.name))
        AND NOT ('texture' = ANY(array_agg(DISTINCT t.name)))
    `);
    
    console.log(`Found ${misplacedImages.rows.length} misplaced precedent+metal images`);
    
    const results = {
      totalFound: misplacedImages.rows.length,
      moved: [],
      errors: []
    };
    
    for (const image of misplacedImages.rows) {
      try {
        console.log(`\n📋 Processing: ${image.filename}`);
        console.log(`   Tags: ${image.tags.join(', ')}`);
        console.log(`   Current path: ${image.dropbox_path}`);
        
        // Determine correct path - should be Precedent/General since no valid precedent categories
        const baseFolder = serverSettings.dropboxFolder || '/ARCHIER Team Folder/Support/Production/SnapTag';
        const correctPath = `${baseFolder}/Precedent/General/${image.filename}`;
        
        console.log(`   Correct path: ${correctPath}`);
        
        // Move file in Dropbox
        console.log(`   🚚 Moving file in Dropbox...`);
        await dropboxService.moveFile(image.dropbox_path, correctPath);
        
        // Update database path
        console.log(`   💾 Updating database path...`);
        await databaseService.query(
          'UPDATE images SET dropbox_path = $1 WHERE id = $2',
          [correctPath, image.id]
        );
        
        results.moved.push({
          id: image.id,
          filename: image.filename,
          from: image.dropbox_path,
          to: correctPath,
          tags: image.tags
        });
        
        console.log(`   ✅ Successfully moved ${image.filename}`);
        
      } catch (error) {
        console.error(`   ❌ Error moving ${image.filename}:`, error.message);
        results.errors.push({
          id: image.id,
          filename: image.filename,
          error: error.message
        });
      }
    }
    
    console.log(`\n📊 Migration complete:`);
    console.log(`   Total found: ${results.totalFound}`);
    console.log(`   Successfully moved: ${results.moved.length}`);
    console.log(`   Errors: ${results.errors.length}`);
    
    res.json({
      success: true,
      message: `Fixed ${results.moved.length} misplaced precedent+metal images`,
      results
    });
    
  } catch (error) {
    console.error('Error fixing precedent+metal images:', error);
    res.status(500).json({ 
      error: 'Failed to fix precedent+metal images', 
      details: error.message 
    });
  }
});

// Check what images are in Texture/Metal folder
app.post('/api/admin/check-texture-metal-images', async (req, res) => {
  try {
    console.log('🔍 Checking images in Texture/Metal folder...');
    
    // Find all images in Texture/Metal folder
    const textureMetalImages = await databaseService.query(`
      SELECT DISTINCT i.id, i.filename, i.dropbox_path,
             array_agg(DISTINCT t.name ORDER BY t.name) as tags
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN tags t ON it.tag_id = t.id
      WHERE i.dropbox_path LIKE '%/Texture/Metal/%'
      GROUP BY i.id, i.filename, i.dropbox_path
      ORDER BY i.filename
    `);
    
    console.log(`Found ${textureMetalImages.rows.length} images in Texture/Metal folder`);
    
    const results = textureMetalImages.rows.map(image => ({
      id: image.id,
      filename: image.filename,
      path: image.dropbox_path,
      tags: image.tags || [],
      hasPrecedent: (image.tags || []).includes('precedent'),
      hasMetal: (image.tags || []).includes('metal'),
      hasTexture: (image.tags || []).includes('texture'),
      shouldBeMoved: (image.tags || []).includes('precedent') && 
                     (image.tags || []).includes('metal') && 
                     !(image.tags || []).includes('texture')
    }));
    
    res.json({
      success: true,
      message: `Found ${results.length} images in Texture/Metal folder`,
      images: results,
      summary: {
        total: results.length,
        withPrecedent: results.filter(img => img.hasPrecedent).length,
        withMetal: results.filter(img => img.hasMetal).length,
        withTexture: results.filter(img => img.hasTexture).length,
        shouldBeMoved: results.filter(img => img.shouldBeMoved).length
      }
    });
    
  } catch (error) {
    console.error('Error checking Texture/Metal images:', error);
    res.status(500).json({ 
      error: 'Failed to check Texture/Metal images', 
      details: error.message 
    });
  }
});

// Sync database paths with manually renamed files
app.post('/api/admin/sync-renamed-files', async (req, res) => {
  try {
    console.log('🔄 Syncing database with manually renamed files...');
    
    // Find images with old filenames that might have been renamed
    const potentiallyRenamed = await databaseService.query(`
      SELECT id, filename, dropbox_path 
      FROM images 
      WHERE filename LIKE '%-materials-%' 
         OR filename LIKE '%-precedents-%'
         OR filename NOT LIKE 'A%'
      ORDER BY filename
    `);
    
    console.log(`Found ${potentiallyRenamed.rows.length} images that might need path updates`);
    
    const results = {
      total: potentiallyRenamed.rows.length,
      updated: [],
      notFound: [],
      errors: []
    };
    
    for (const image of potentiallyRenamed.rows) {
      try {
        console.log(`\n📋 Checking: ${image.filename}`);
        console.log(`   Current path: ${image.dropbox_path}`);
        
        // Try to find the file at its current path
        let fileExists = false;
        try {
          await dropboxService.dbx.filesGetMetadata({ path: image.dropbox_path });
          fileExists = true;
          console.log(`   ✅ File found at current path`);
        } catch (error) {
          if (error.status === 409) {
            console.log(`   ❌ File not found at current path`);
            fileExists = false;
          } else {
            throw error;
          }
        }
        
        if (!fileExists) {
          // File doesn't exist at current path - it was likely renamed
          // Try to find files with similar structure in the same folder
          const folderPath = image.dropbox_path.substring(0, image.dropbox_path.lastIndexOf('/'));
          
          try {
            // List files in the folder
            const folderContents = await dropboxService.dbx.filesListFolder({ path: folderPath });
            
            // Look for files that might be the renamed version
            const possibleMatch = folderContents.result.entries.find(entry => {
              return entry['.tag'] === 'file' && 
                     (entry.name.includes('precedent') || entry.name.includes('general')) &&
                     entry.name.endsWith('.jpg');
            });
            
            if (possibleMatch) {
              const newPath = `${folderPath}/${possibleMatch.name}`;
              console.log(`   🔄 Found possible match: ${possibleMatch.name}`);
              console.log(`   📝 Updating database path to: ${newPath}`);
              
              // Update database with new path and filename
              await databaseService.query(
                'UPDATE images SET dropbox_path = $1, filename = $2 WHERE id = $3',
                [newPath, possibleMatch.name, image.id]
              );
              
              results.updated.push({
                id: image.id,
                oldFilename: image.filename,
                newFilename: possibleMatch.name,
                oldPath: image.dropbox_path,
                newPath: newPath
              });
            } else {
              console.log(`   ❓ No matching file found in folder`);
              results.notFound.push({
                id: image.id,
                filename: image.filename,
                path: image.dropbox_path
              });
            }
          } catch (folderError) {
            console.log(`   ❌ Error accessing folder: ${folderError.message}`);
            results.errors.push({
              id: image.id,
              filename: image.filename,
              error: `Folder access error: ${folderError.message}`
            });
          }
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing ${image.filename}:`, error.message);
        results.errors.push({
          id: image.id,
          filename: image.filename,
          error: error.message
        });
      }
    }
    
    console.log(`\n📊 Sync complete:`);
    console.log(`   Total checked: ${results.total}`);
    console.log(`   Updated: ${results.updated.length}`);
    console.log(`   Not found: ${results.notFound.length}`);
    console.log(`   Errors: ${results.errors.length}`);
    
    res.json({
      success: true,
      message: `Synced ${results.updated.length} renamed files`,
      results
    });
    
  } catch (error) {
    console.error('Error syncing renamed files:', error);
    res.status(500).json({ 
      error: 'Failed to sync renamed files', 
      details: error.message 
    });
  }
});

// Update database paths for manually renamed files (simple approach)
app.post('/api/admin/update-renamed-paths', async (req, res) => {
  try {
    console.log('🔄 Updating database paths for manually renamed files...');
    
    const updates = [];
    
    // Update materials-metal files to precedent-general
    const materialFiles = await databaseService.query(`
      SELECT id, filename, dropbox_path 
      FROM images 
      WHERE filename LIKE '%-materials-metal.jpg'
    `);
    
    for (const file of materialFiles.rows) {
      // Extract the number part (e.g., 0087 from 0087-materials-metal.jpg)
      const numberMatch = file.filename.match(/(\d+)-materials-metal\.jpg/);
      if (numberMatch) {
        const number = numberMatch[1];
        const newFilename = `A${number}-precedent-general.jpg`;
        const newPath = file.dropbox_path.replace(file.filename, newFilename);
        
        updates.push({
          id: file.id,
          oldFilename: file.filename,
          newFilename: newFilename,
          oldPath: file.dropbox_path,
          newPath: newPath
        });
      }
    }
    
    // Update precedents-exteriors files to precedent-exteriors  
    const precedentFiles = await databaseService.query(`
      SELECT id, filename, dropbox_path 
      FROM images 
      WHERE filename LIKE '%-precedents-exteriors.jpg'
    `);
    
    for (const file of precedentFiles.rows) {
      // Extract the number part (e.g., 0124 from 0124-precedents-exteriors.jpg)
      const numberMatch = file.filename.match(/(\d+)-precedents-exteriors\.jpg/);
      if (numberMatch) {
        const number = numberMatch[1];
        const newFilename = `A${number}-precedent-exteriors.jpg`;
        const newPath = file.dropbox_path.replace(file.filename, newFilename);
        
        updates.push({
          id: file.id,
          oldFilename: file.filename,
          newFilename: newFilename,
          oldPath: file.dropbox_path,
          newPath: newPath
        });
      }
    }
    
    // Update precedents-stairs files
    const stairFiles = await databaseService.query(`
      SELECT id, filename, dropbox_path 
      FROM images 
      WHERE filename LIKE '%-precedents-stairs.jpg'
    `);
    
    for (const file of stairFiles.rows) {
      const numberMatch = file.filename.match(/(\d+)-precedents-stairs\.jpg/);
      if (numberMatch) {
        const number = numberMatch[1];
        const newFilename = `A${number}-precedent-stairs.jpg`;
        const newPath = file.dropbox_path.replace(file.filename, newFilename);
        
        updates.push({
          id: file.id,
          oldFilename: file.filename,
          newFilename: newFilename,
          oldPath: file.dropbox_path,
          newPath: newPath
        });
      }
    }
    
    console.log(`Found ${updates.length} files to update`);
    
    // Apply all updates
    const results = { updated: [], errors: [] };
    
    for (const update of updates) {
      try {
        await databaseService.query(
          'UPDATE images SET filename = $1, dropbox_path = $2 WHERE id = $3',
          [update.newFilename, update.newPath, update.id]
        );
        
        results.updated.push(update);
        console.log(`✅ Updated: ${update.oldFilename} → ${update.newFilename}`);
      } catch (error) {
        results.errors.push({
          ...update,
          error: error.message
        });
        console.error(`❌ Error updating ${update.oldFilename}: ${error.message}`);
      }
    }
    
    console.log(`📊 Update complete: ${results.updated.length} updated, ${results.errors.length} errors`);
    
    res.json({
      success: true,
      message: `Updated ${results.updated.length} file paths`,
      results: {
        total: updates.length,
        updated: results.updated,
        errors: results.errors
      }
    });
    
  } catch (error) {
    console.error('Error updating renamed paths:', error);
    res.status(500).json({ 
      error: 'Failed to update renamed paths', 
      details: error.message 
    });
  }
});

// Refresh Dropbox token and test connection
app.post('/api/admin/refresh-dropbox-token', async (req, res) => {
  try {
    console.log('🔄 Refreshing Dropbox access token...');
    
    // Refresh the access token
    await dropboxService.refreshAccessToken();
    console.log('✅ Dropbox token refreshed successfully');
    
    // Test the connection by listing a folder
    console.log('🧪 Testing Dropbox connection...');
    const testResult = await dropboxService.dbx.filesListFolder({ 
      path: '/ARCHIER Team Folder/Support/Production/SnapTag',
      limit: 1
    });
    
    console.log('✅ Dropbox connection test successful');
    
    // Test generating a temporary link for the first file found
    let testUrl = null;
    if (testResult.result.entries.length > 0) {
      const testFile = testResult.result.entries[0];
      if (testFile['.tag'] === 'file') {
        try {
          testUrl = await dropboxService.getTemporaryLink(testFile.path_lower);
          console.log('✅ Temporary URL generation test successful');
        } catch (urlError) {
          console.log('❌ Temporary URL generation failed:', urlError.message);
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Dropbox token refreshed and connection tested',
      results: {
        tokenRefreshed: true,
        connectionTest: 'passed',
        filesFound: testResult.result.entries.length,
        testUrlGenerated: !!testUrl,
        testFile: testResult.result.entries[0]?.name || 'none'
      }
    });
    
  } catch (error) {
    console.error('Error refreshing Dropbox token:', error);
    res.status(500).json({ 
      error: 'Failed to refresh Dropbox token', 
      details: error.message 
    });
  }
});

startServer(); 