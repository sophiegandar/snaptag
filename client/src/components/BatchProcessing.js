import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Tag, 
  Database, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertCircle,
  Plus
} from 'lucide-react';
import { toast } from 'react-toastify';

const BatchProcessing = () => {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [images, setImages] = useState([]);
  const [showImageSelector, setShowImageSelector] = useState(false);

  useEffect(() => {
    loadJobs();
    loadImages();
    
    // Poll for job updates every 2 seconds
    const interval = setInterval(loadJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/batch/jobs');
      const jobsData = await response.json();
      setJobs(jobsData);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadImages = async () => {
    try {
      const response = await fetch('/api/images');
      const imagesData = await response.json();
      setImages(imagesData);
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  const startBatchMetadataUpdate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/batch/metadata-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        loadJobs();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to start batch metadata update');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startMissingMetadataRestore = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/batch/restore-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        loadJobs();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to start metadata restoration');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyTagsToSelected = async () => {
    if (selectedImages.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    if (!newTagInput.trim()) {
      toast.error('Please enter at least one tag');
      return;
    }

    const tags = newTagInput.split(',').map(tag => tag.trim()).filter(Boolean);
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/batch/apply-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds: selectedImages,
          tags: tags
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        setSelectedImages([]);
        setNewTagInput('');
        setShowImageSelector(false);
        loadJobs();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to apply tags');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyTagsToAll = async () => {
    if (!newTagInput.trim()) {
      toast.error('Please enter at least one tag');
      return;
    }

    const tags = newTagInput.split(',').map(tag => tag.trim()).filter(Boolean);
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/batch/tag-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        setNewTagInput('');
        loadJobs();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to apply tags to all images');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelJob = async (jobId) => {
    try {
      const response = await fetch(`/api/batch/jobs/${jobId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        loadJobs();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to cancel job');
      console.error('Error:', error);
    }
  };

  const toggleImageSelection = (imageId) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllImages = () => {
    setSelectedImages(images.map(img => img.id));
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled': return <Square className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch Processing</h1>
        <p className="text-gray-600">
          Manage bulk operations on your image library. Process metadata, apply tags, and restore missing information.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Database className="h-6 w-6 text-blue-500 mr-2" />
            <h3 className="text-lg font-semibold">Update All Metadata</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Apply current tags and metadata to all images stored in Dropbox.
          </p>
          <button
            onClick={startBatchMetadataUpdate}
            disabled={isLoading}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Update
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <RefreshCw className="h-6 w-6 text-green-500 mr-2" />
            <h3 className="text-lg font-semibold">Restore Metadata</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Find and restore metadata from images that may have lost their tags.
          </p>
          <button
            onClick={startMissingMetadataRestore}
            disabled={isLoading}
            className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center justify-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Restore Missing
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Tag className="h-6 w-6 text-purple-500 mr-2" />
            <h3 className="text-lg font-semibold">Batch Tag Application</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Apply tags to multiple images at once.
          </p>
          <button
            onClick={() => setShowImageSelector(!showImageSelector)}
            className="w-full bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 flex items-center justify-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Select Images
          </button>
        </div>
      </div>

      {/* Tag Application Section */}
      {showImageSelector && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Apply Tags to Images</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              placeholder="architecture, interior, modern, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-4 mb-4">
            <button
              onClick={applyTagsToAll}
              disabled={isLoading || !newTagInput.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              Apply to All Images ({images.length})
            </button>
            <button
              onClick={applyTagsToSelected}
              disabled={isLoading || selectedImages.length === 0 || !newTagInput.trim()}
              className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 disabled:opacity-50"
            >
              Apply to Selected ({selectedImages.length})
            </button>
            <button
              onClick={selectAllImages}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Clear Selection
            </button>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-96 overflow-y-auto">
            {images.map(image => (
              <div
                key={image.id}
                onClick={() => toggleImageSelection(image.id)}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImages.includes(image.id)
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {image.url && (
                  <img
                    src={image.url}
                    alt={image.title || image.filename}
                    className="w-full h-20 object-cover"
                  />
                )}
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate">
                    {image.title || image.filename}
                  </p>
                </div>
                {selectedImages.includes(image.id) && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-5 w-5 text-purple-500 bg-white rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Jobs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Active Jobs</h2>
        </div>
        
        <div className="p-6">
          {jobs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No batch jobs running</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map(job => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {getStatusIcon(job.status)}
                      <span className="ml-2 font-medium">
                        Job #{job.id} - {job.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {formatDuration(job.duration)}
                      </span>
                      {job.status === 'running' && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {job.progress && (
                    <div className="mb-2">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress: {job.progress.completed}/{job.progress.total}</span>
                        <span>Failed: {job.progress.failed}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${job.progress.total > 0 ? (job.progress.completed / job.progress.total) * 100 : 0}%`
                          }}
                        />
                      </div>
                      {job.progress.current && (
                        <p className="text-sm text-gray-500 mt-1">{job.progress.current}</p>
                      )}
                    </div>
                  )}
                  
                  {job.error && (
                    <div className="text-red-500 text-sm">{job.error}</div>
                  )}
                  
                  {job.errors && job.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm text-gray-500 cursor-pointer">
                        Show errors ({job.errors.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {job.errors.map((error, index) => (
                          <div key={index} className="text-xs text-red-500">
                            {error.filename || error.imageId}: {error.error}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchProcessing; 