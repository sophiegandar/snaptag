const databaseService = require('./databaseService');
const metadataService = require('./metadataService');
const dropboxService = require('./dropboxService');
const fs = require('fs').promises;
const path = require('path');

class BatchProcessingService {
  constructor() {
    this.activeJobs = new Map();
    this.jobCounter = 0;
  }

  // Start a batch metadata update job
  async startBatchMetadataUpdate(options = {}) {
    const jobId = ++this.jobCounter;
    const job = {
      id: jobId,
      type: 'metadata_update',
      status: 'running',
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        current: null
      },
      startTime: new Date(),
      errors: [],
      options
    };

    this.activeJobs.set(jobId, job);

    // Run the job asynchronously
    this._runBatchMetadataUpdate(job).catch(error => {
      console.error('Batch job failed:', error);
      job.status = 'failed';
      job.error = error.message;
    });

    return jobId;
  }

  // Start a batch tag application job
  async startBatchTagApplication(imageIds, tags, options = {}) {
    const jobId = ++this.jobCounter;
    const job = {
      id: jobId,
      type: 'tag_application',
      status: 'running',
      progress: {
        total: imageIds.length,
        completed: 0,
        failed: 0,
        current: null
      },
      startTime: new Date(),
      errors: [],
      options: { ...options, imageIds, tags }
    };

    this.activeJobs.set(jobId, job);

    // Run the job asynchronously
    this._runBatchTagApplication(job).catch(error => {
      console.error('Batch tag job failed:', error);
      job.status = 'failed';
      job.error = error.message;
    });

    return jobId;
  }

  // Get job status
  getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.endTime ? (job.endTime - job.startTime) : (new Date() - job.startTime),
      errors: job.errors.slice(-10), // Return last 10 errors
      error: job.error
    };
  }

  // Get all active jobs
  getAllJobs() {
    return Array.from(this.activeJobs.values()).map(job => this.getJobStatus(job.id));
  }

  // Cancel a job
  cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'running') {
      job.status = 'cancelled';
      job.endTime = new Date();
      return true;
    }
    return false;
  }

  // Clean up completed jobs (older than 1 hour)
  cleanupOldJobs() {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.endTime && job.endTime < cutoff) {
        this.activeJobs.delete(jobId);
      }
    }
  }

  // Private method to run batch metadata update
  async _runBatchMetadataUpdate(job) {
    try {
      console.log(`🚀 Starting batch metadata update job ${job.id}`);

      // Get all images from database
      const images = await databaseService.getAllImages();
      job.progress.total = images.length;

      console.log(`📊 Found ${images.length} images to process`);

      for (let i = 0; i < images.length; i++) {
        if (job.status === 'cancelled') {
          console.log(`⏹️ Job ${job.id} cancelled`);
          break;
        }

        const image = images[i];
        job.progress.current = `Processing ${image.filename}`;

        try {
          // Get current tags for this image
          const tags = await databaseService.getImageTags(image.id);
          const focusedTags = await databaseService.getFocusedTags(image.id);

          // Update metadata in Dropbox
          await metadataService.updateImageMetadata(image.dropbox_path, {
            tags: tags.map(t => t.name),
            title: image.title,
            description: image.description,
            focusedTags
          });

          job.progress.completed++;
          console.log(`✅ Updated metadata for ${image.filename} (${job.progress.completed}/${job.progress.total})`);

        } catch (error) {
          job.progress.failed++;
          job.errors.push({
            imageId: image.id,
            filename: image.filename,
            error: error.message,
            timestamp: new Date()
          });
          
          console.error(`❌ Failed to update ${image.filename}:`, error.message);
        }

        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      job.status = job.status === 'cancelled' ? 'cancelled' : 'completed';
      job.endTime = new Date();

      console.log(`🎉 Batch metadata update job ${job.id} completed. Success: ${job.progress.completed}, Failed: ${job.progress.failed}`);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
      console.error(`💥 Batch metadata update job ${job.id} failed:`, error);
    }
  }

  // Private method to run batch tag application
  async _runBatchTagApplication(job) {
    try {
      console.log(`🚀 Starting batch tag application job ${job.id}`);
      const { imageIds, tags } = job.options;

      console.log(`🏷️ Applying tags [${tags.join(', ')}] to ${imageIds.length} images`);

      for (let i = 0; i < imageIds.length; i++) {
        if (job.status === 'cancelled') {
          console.log(`⏹️ Job ${job.id} cancelled`);
          break;
        }

        const imageId = imageIds[i];
        job.progress.current = `Applying tags to image ID ${imageId}`;

        try {
          // Get current image data
          const image = await databaseService.getImageById(imageId);
          if (!image) {
            throw new Error('Image not found');
          }

          // Get existing tags
          const existingTags = await databaseService.getImageTags(imageId);
          const existingTagNames = existingTags.map(t => t.name);

          // Merge with new tags (avoid duplicates)
          const allTags = [...new Set([...existingTagNames, ...tags])];

          // Update tags in database
          await databaseService.updateImageTags(imageId, allTags, []);

          // Update metadata in Dropbox
          await metadataService.updateImageMetadata(image.dropbox_path, {
            tags: allTags,
            title: image.title,
            description: image.description,
            focusedTags: await databaseService.getFocusedTags(imageId)
          });

          job.progress.completed++;
          console.log(`✅ Applied tags to ${image.filename} (${job.progress.completed}/${job.progress.total})`);

        } catch (error) {
          job.progress.failed++;
          job.errors.push({
            imageId,
            error: error.message,
            timestamp: new Date()
          });
          
          console.error(`❌ Failed to apply tags to image ID ${imageId}:`, error.message);
        }

        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      job.status = job.status === 'cancelled' ? 'cancelled' : 'completed';
      job.endTime = new Date();

      console.log(`🎉 Batch tag application job ${job.id} completed. Success: ${job.progress.completed}, Failed: ${job.progress.failed}`);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
      console.error(`💥 Batch tag application job ${job.id} failed:`, error);
    }
  }

  // Process images missing metadata
  async startMissingMetadataUpdate() {
    const jobId = ++this.jobCounter;
    const job = {
      id: jobId,
      type: 'missing_metadata',
      status: 'running',
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        current: null
      },
      startTime: new Date(),
      errors: []
    };

    this.activeJobs.set(jobId, job);

    try {
      // Find images that might be missing metadata
      const images = await databaseService.getAllImages();
      const imagesNeedingMetadata = [];

      for (const image of images) {
        // Check if image has tags or if we need to verify metadata
        const tags = await databaseService.getImageTags(image.id);
        if (tags.length === 0) {
          imagesNeedingMetadata.push(image);
        }
      }

      job.progress.total = imagesNeedingMetadata.length;
      console.log(`📊 Found ${imagesNeedingMetadata.length} images potentially missing metadata`);

      // Process each image
      for (const image of imagesNeedingMetadata) {
        if (job.status === 'cancelled') break;

        job.progress.current = `Checking ${image.filename}`;

        try {
          // Try to read existing metadata from the file
          const tempPath = `temp/check-${Date.now()}-${path.basename(image.dropbox_path)}`;
          
          await dropboxService.downloadFile(image.dropbox_path, tempPath);
          const existingMetadata = await metadataService.readMetadata(tempPath);
          
          // If we found tags in the file metadata, update the database
          if (existingMetadata.tags && existingMetadata.tags.length > 0) {
            await databaseService.updateImageTags(image.id, existingMetadata.tags, existingMetadata.focusedTags || []);
            console.log(`🔄 Restored ${existingMetadata.tags.length} tags for ${image.filename}`);
          }

          // Cleanup temp file
          await fs.unlink(tempPath);
          
          job.progress.completed++;

        } catch (error) {
          job.progress.failed++;
          job.errors.push({
            imageId: image.id,
            filename: image.filename,
            error: error.message,
            timestamp: new Date()
          });
        }
      }

      job.status = 'completed';
      job.endTime = new Date();
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
    }

    return jobId;
  }
}

// Clean up old jobs every hour
setInterval(() => {
  const service = require('./batchProcessingService');
  service.cleanupOldJobs();
}, 60 * 60 * 1000);

module.exports = new BatchProcessingService(); 