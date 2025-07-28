const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const dropboxService = require('./services/dropboxService');
const metadataService = require('./services/metadataService');
const databaseService = require('./services/databaseService');
const batchProcessingService = require('./services/batchProcessingService');
const filenameGeneratorService = require('./services/filenameGeneratorService');
const professionalWorkflowService = require('./services/professionalWorkflowService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
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
    const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Initialize database
databaseService.init();

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

    await databaseService.updateImageTags(id, tags, focusedTags);
    
    // Update metadata in Dropbox file
    const image = await databaseService.getImageById(id);
    if (image) {
      await metadataService.updateImageMetadata(image.dropbox_path, {
        tags,
        focusedTags
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating tags:', error);
    res.status(500).json({ error: 'Failed to update tags' });
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

// Get system statistics
app.get('/api/images/stats', async (req, res) => {
  try {
    const stats = await databaseService.getImageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Advanced search endpoint
app.post('/api/images/search', async (req, res) => {
  try {
    const filters = req.body;
    console.log('🔍 Advanced search with filters:', filters);
    
    const images = await databaseService.advancedSearchImages(filters);
    res.json(images);
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Failed to search images' });
  }
});

// Get available source websites
app.get('/api/images/sources', async (req, res) => {
  try {
    const sources = await databaseService.getImageSources();
    res.json(sources);
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

// ==== PROFESSIONAL WORKFLOW ENDPOINTS ====

// Analyze image for InDesign workflow
app.post('/api/workflow/analyze-indesign/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const options = req.body;
    
    const image = await databaseService.getImageById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Use database metadata instead of downloading file
    const analysisOptions = { ...options, imageData: image };
    const analysis = await professionalWorkflowService.optimizeForInDesign(image.dropbox_path, analysisOptions);
    analysis.imageInfo = {
      id: image.id,
      filename: image.filename,
      title: image.title
    };
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing for InDesign:', error);
    res.status(500).json({ error: 'Failed to analyze image for InDesign' });
  }
});

// Analyze image for ArchiCAD workflow
app.post('/api/workflow/analyze-archicad/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const options = req.body;
    
    const image = await databaseService.getImageById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Use database metadata instead of downloading file
    const analysisOptions = { ...options, imageData: image };
    const analysis = await professionalWorkflowService.optimizeForArchiCAD(image.dropbox_path, analysisOptions);
    analysis.imageInfo = {
      id: image.id,
      filename: image.filename,
      title: image.title
    };
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing for ArchiCAD:', error);
    res.status(500).json({ error: 'Failed to analyze image for ArchiCAD' });
  }
});

// Generate professional filename for image
app.post('/api/workflow/generate-filename/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const options = req.body;
    
    const image = await databaseService.getImageById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const metadata = {
      title: image.title,
      description: image.description,
      tags: image.tags || [],
      originalName: image.original_name,
      filename: image.filename
    };

    const professionalFilename = professionalWorkflowService.generateProfessionalFilename(metadata, options);
    
    res.json({
      originalFilename: image.filename,
      professionalFilename: professionalFilename,
      metadata: metadata,
      options: options
    });
  } catch (error) {
    console.error('Error generating professional filename:', error);
    res.status(500).json({ error: 'Failed to generate professional filename' });
  }
});

// Batch analyze all images for workflow optimization
app.post('/api/workflow/batch-analyze', async (req, res) => {
  try {
    const { workflow = 'both', imageIds = [] } = req.body;
    
    // Get images to analyze
    let images;
    if (imageIds.length > 0) {
      images = await Promise.all(imageIds.map(id => databaseService.getImageById(id)));
      images = images.filter(Boolean);
    } else {
      images = await databaseService.getAllImages();
    }

    const analyses = [];
    
    for (const image of images.slice(0, 10)) { // Limit to 10 for demo
      try {
        const imageAnalysis = { imageId: image.id, filename: image.filename };

        if (workflow === 'indesign' || workflow === 'both') {
          imageAnalysis.indesign = await professionalWorkflowService.optimizeForInDesign(
            image.dropbox_path, 
            { imageData: image }
          );
        }

        if (workflow === 'archicad' || workflow === 'both') {
          imageAnalysis.archicad = await professionalWorkflowService.optimizeForArchiCAD(
            image.dropbox_path, 
            { imageData: image }
          );
        }

        analyses.push(imageAnalysis);
        
      } catch (error) {
        console.error(`Error analyzing image ${image.id}:`, error);
        analyses.push({
          imageId: image.id,
          filename: image.filename,
          error: error.message
        });
      }
    }

    // Generate workflow report
    const allOptimizations = analyses.flatMap(a => [a.indesign, a.archicad].filter(Boolean));
    const report = professionalWorkflowService.generateWorkflowReport(allOptimizations);

    res.json({
      analyses: analyses,
      report: report,
      summary: {
        totalAnalyzed: analyses.length,
        workflows: workflow,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in batch workflow analysis:', error);
    res.status(500).json({ error: 'Failed to perform batch workflow analysis' });
  }
});

// ==== BATCH PROCESSING ENDPOINTS ====

// Start batch metadata update for all images
app.post('/api/batch/metadata-update', async (req, res) => {
  try {
    const jobId = await batchProcessingService.startBatchMetadataUpdate();
    res.json({ 
      success: true, 
      jobId,
      message: 'Batch metadata update started'
    });
  } catch (error) {
    console.error('Error starting batch metadata update:', error);
    res.status(500).json({ error: 'Failed to start batch metadata update' });
  }
});

// Start batch tag application
app.post('/api/batch/apply-tags', async (req, res) => {
  try {
    const { imageIds, tags } = req.body;
    
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'imageIds array is required' });
    }
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'tags array is required' });
    }

    const jobId = await batchProcessingService.startBatchTagApplication(imageIds, tags);
    res.json({ 
      success: true, 
      jobId,
      message: `Batch tag application started for ${imageIds.length} images`
    });
  } catch (error) {
    console.error('Error starting batch tag application:', error);
    res.status(500).json({ error: 'Failed to start batch tag application' });
  }
});

// Start missing metadata restoration
app.post('/api/batch/restore-metadata', async (req, res) => {
  try {
    const jobId = await batchProcessingService.startMissingMetadataUpdate();
    res.json({ 
      success: true, 
      jobId,
      message: 'Missing metadata restoration started'
    });
  } catch (error) {
    console.error('Error starting metadata restoration:', error);
    res.status(500).json({ error: 'Failed to start metadata restoration' });
  }
});

// Get job status
app.get('/api/batch/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = batchProcessingService.getJobStatus(parseInt(jobId));
    
    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// Get all jobs
app.get('/api/batch/jobs', async (req, res) => {
  try {
    const jobs = batchProcessingService.getAllJobs();
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Cancel a job
app.delete('/api/batch/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const cancelled = batchProcessingService.cancelJob(parseInt(jobId));
    
    if (!cancelled) {
      return res.status(404).json({ error: 'Job not found or cannot be cancelled' });
    }

    res.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Batch tag application to all images with a filter
app.post('/api/batch/tag-all', async (req, res) => {
  try {
    const { tags, filter } = req.body;
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'tags array is required' });
    }

    // Get images based on filter
    let images;
    if (filter && filter.searchTerm) {
      images = await databaseService.searchImages(filter.searchTerm);
    } else {
      images = await databaseService.getAllImages();
    }

    const imageIds = images.map(img => img.id);
    
    if (imageIds.length === 0) {
      return res.status(400).json({ error: 'No images found matching criteria' });
    }

    const jobId = await batchProcessingService.startBatchTagApplication(imageIds, tags);
    res.json({ 
      success: true, 
      jobId,
      message: `Batch tag application started for ${imageIds.length} images`,
      affectedImages: imageIds.length
    });
  } catch (error) {
    console.error('Error starting batch tag all:', error);
    res.status(500).json({ error: 'Failed to start batch tag all' });
  }
});

// Helper functions
async function processAndUploadImage({ filePath, originalName, tags, title, description, focusedTags, sourceUrl }) {
  console.log('🏷️ Adding metadata to image...');
  // Add metadata to image
  const processedImagePath = await metadataService.addMetadataToImage(filePath, {
    tags,
    title,
    description,
    focusedTags
  });
  console.log('✅ Metadata added, processed image:', processedImagePath);

  // Get existing filenames to avoid duplicates
  const existingImages = await databaseService.getAllImages();
  const existingFilenames = existingImages.map(img => img.filename);

  // Generate smart filename
  console.log('🧠 Generating smart filename...');
  const filename = await filenameGeneratorService.generateFilename({
    originalName,
    sourceUrl,
    title,
    description,
    tags,
    existingFilenames
  });
  
  const dropboxFolder = serverSettings.dropboxFolder || process.env.DROPBOX_FOLDER || '/SnapTag';
  const dropboxPath = `${dropboxFolder}/${filename}`;
  console.log('📂 Smart filename generated:', filename);
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
    dropbox_id: uploadResult.id
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
      focusedTags,
      sourceUrl
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

app.listen(PORT, () => {
  console.log(`SnapTag server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 