import React, { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Trash2, Edit, RefreshCw, AlertTriangle, Tag, Plus, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AdvancedSearch from './AdvancedSearch';
import { apiCall } from '../utils/apiConfig';

const ImageGallery = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [currentFilters, setCurrentFilters] = useState({});
  const [lastErrorTime, setLastErrorTime] = useState(0);
  
  // Untagged images state
  const [untaggedImages, setUntaggedImages] = useState([]);
  const [showUntagged, setShowUntagged] = useState(true);
  const [selectedUntagged, setSelectedUntagged] = useState([]);
  const [quickTags, setQuickTags] = useState('');

  useEffect(() => {
    loadImages();
    loadUntaggedImages();
    
    // Set up polling for real-time updates every 30 seconds
    const pollInterval = setInterval(() => {
      // Only poll if there are no current filters (showing all images)
      if (Object.keys(currentFilters).length === 0) {
        console.log('🔄 Polling for new images...');
        loadImages(currentFilters);
        loadUntaggedImages();
      }
    }, 30000);
    
    return () => clearInterval(pollInterval);
  }, []);

  const loadImages = async (searchFilters = {}) => {
    try {
      setLoading(true);
      setCurrentFilters(searchFilters);
      
      console.log('🔍 Loading images with filters:', searchFilters);
      
      const response = await apiCall('/api/images/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchFilters)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Response not OK:', response.status, errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Images loaded successfully:', data.length, 'images');
      setImages(data);
    } catch (error) {
      console.error('❌ Error loading images:', error);
      
      // Prevent duplicate error toasts (max 1 per 2 seconds)
      const now = Date.now();
      if (now - lastErrorTime > 2000) {
        toast.error('Failed to load images');
        setLastErrorTime(now);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancedSearch = (filters) => {
    loadImages(filters);
  };

  const clearFilters = () => {
    setCurrentFilters({});
    loadImages({});
  };

  const handleTagClick = (tagName) => {
    // Add clicked tag to current filters
    const newFilters = {
      ...currentFilters,
      tags: [...(currentFilters.tags || []), tagName]
    };
    handleAdvancedSearch(newFilters);
  };

  const loadUntaggedImages = async () => {
    try {
      const response = await apiCall('/api/images/untagged');
      const data = await response.json();
      
      if (data.success) {
        setUntaggedImages(data.images);
        console.log(`📊 Found ${data.images.length} untagged images`);
      }
    } catch (error) {
      console.error('Error loading untagged images:', error);
    }
  };

  const toggleUntaggedSelection = (imageId) => {
    setSelectedUntagged(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllUntagged = () => {
    setSelectedUntagged(untaggedImages.map(img => img.id));
  };

  const clearUntaggedSelection = () => {
    setSelectedUntagged([]);
  };

  const applyQuickTags = async () => {
    if (selectedUntagged.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    if (!quickTags.trim()) {
      toast.error('Please enter at least one tag');
      return;
    }

    const tags = quickTags.split(',').map(tag => tag.trim()).filter(Boolean);
    
    try {
      setLoading(true);
      const response = await apiCall('/api/batch/apply-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds: selectedUntagged,
          tags: tags
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        
        // Show additional info about duplicates if any
        if (result.stats && result.stats.duplicateInfo && result.stats.duplicateInfo.length > 0) {
          const duplicateCount = result.stats.duplicateInfo.length;
          toast.info(`${duplicateCount} image(s) had duplicate tags that were skipped`, { autoClose: 5000 });
        }
        
        // Show info about moved files if any
        if (result.stats && result.stats.processedImages) {
          const movedCount = result.stats.processedImages.filter(img => img.moved).length;
          if (movedCount > 0) {
            toast.info(`${movedCount} image(s) moved to new folder structure`, { autoClose: 5000 });
          }
        }
        
        // Refresh data
        await loadImages(currentFilters);
        await loadUntaggedImages();
        
        // Clear selections
        setSelectedUntagged([]);
        setQuickTags('');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Error applying quick tags:', error);
      toast.error('Failed to apply tags');
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (imageId, imageName) => {
    if (!window.confirm(`Are you sure you want to delete "${imageName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiCall(`/api/images/${imageId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // Remove image from local state
      setImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Loading images...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Advanced Search Interface */}
      <AdvancedSearch onSearch={handleAdvancedSearch} initialFilters={currentFilters} />

      {/* Untagged Images Section */}
      {untaggedImages.length > 0 && showUntagged && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="px-6 py-4 border-b border-yellow-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                <h3 className="text-lg font-semibold text-yellow-800">
                  {untaggedImages.length} Untagged Image{untaggedImages.length !== 1 ? 's' : ''}
                </h3>
                <span className="ml-2 text-sm text-yellow-600">
                  Need organization
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={selectAllUntagged}
                  className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-md hover:bg-yellow-200"
                >
                  Select All
                </button>
                <button
                  onClick={clearUntaggedSelection}
                  className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-md hover:bg-yellow-200"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowUntagged(false)}
                  className="text-sm text-yellow-600 hover:text-yellow-800"
                >
                  Hide
                </button>
                <span className="text-sm text-yellow-600">
                  {selectedUntagged.length} selected
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tagging */}
          {selectedUntagged.length > 0 && (
            <div className="px-6 py-3 bg-blue-50 border-b border-yellow-200">
              <div className="flex items-center space-x-4">
                <Tag className="h-5 w-5 text-blue-500" />
                <input
                  type="text"
                  value={quickTags}
                  onChange={(e) => setQuickTags(e.target.value)}
                  placeholder="Enter tags (comma-separated): archier, facade, glazing..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={applyQuickTags}
                  disabled={loading || !quickTags.trim()}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Apply to {selectedUntagged.length}
                </button>
              </div>
            </div>
          )}

          {/* Untagged Images Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {untaggedImages.map((image) => (
                <div
                  key={image.id}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    selectedUntagged.includes(image.id)
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleUntaggedSelection(image.id)}
                >
                  <div className="aspect-square">
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  
                  {selectedUntagged.includes(image.id) && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-blue-500 text-white rounded-full p-1">
                        <CheckCircle className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-white text-xs font-medium truncate">
                      {image.filename}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Show Untagged Button (when hidden) */}
      {untaggedImages.length > 0 && !showUntagged && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-yellow-800">
                {untaggedImages.length} untagged image{untaggedImages.length !== 1 ? 's' : ''} need attention
              </span>
            </div>
            <button
              onClick={() => setShowUntagged(true)}
              className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600"
            >
              Show Untagged Images
            </button>
          </div>
        </div>
      )}

      {/* Results Summary & View Controls */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {images.length} image{images.length !== 1 ? 's' : ''} found
          {Object.keys(currentFilters).length > 0 && (
            <span className="ml-2 text-blue-600">
              (filtered)
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => loadImages(currentFilters)}
            className="p-2 rounded-md bg-gray-200 hover:bg-gray-300 transition-colors"
            title="Refresh images"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image Grid/List */}
      {images.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
          <p className="text-gray-500">
            {Object.keys(currentFilters).length > 0
              ? 'Try adjusting your search terms or filters'
              : 'Upload some images to get started'
            }
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'image-gallery-grid' : 'space-y-4'}>
          {images.map(image => (
            <ImageCard 
              key={image.id} 
              image={image} 
              viewMode={viewMode}
              onTagClick={handleTagClick}
              onDelete={deleteImage}
              onEdit={(id) => navigate(`/image/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ImageCard = ({ image, viewMode, onTagClick, onDelete, onEdit }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Reset error state when image changes
    setImageError(false);
    setImageUrl(image.url || '/api/placeholder-image.jpg');
  }, [image]);

  const handleImageError = () => {
    console.warn(`Failed to load image: ${image.filename}`, { url: imageUrl, dropbox_path: image.dropbox_path });
    setImageError(true);
    // Try to reload the image URL by refetching
    if (image.url && !imageError) {
      console.log('Attempting to reload image...');
      setTimeout(() => {
        setImageUrl(image.url + '?retry=' + Date.now());
      }, 1000);
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="bg-white p-4 rounded-lg shadow flex gap-4">
        {imageError ? (
          <div className="w-24 h-24 bg-gray-200 flex items-center justify-center rounded cursor-pointer" onClick={() => onEdit(image.id)}>
            <div className="text-center text-gray-500">
              <div className="text-lg">🖼️</div>
            </div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={image.title || image.filename}
            className="w-24 h-24 object-cover rounded cursor-pointer"
            onClick={() => onEdit(image.id)}
            onError={handleImageError}
          />
        )}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-gray-900">{image.title || image.filename}</h3>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => onEdit(image.id)}
                className="p-1 text-gray-500 hover:text-blue-600"
                title="Edit image"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(image.id, image.title || image.filename)}
                className="p-1 text-gray-500 hover:text-red-600"
                title="Delete image"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="text-gray-600 text-sm mt-1">{image.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {image.tags?.map(tag => (
              <span
                key={tag}
                onClick={() => onTagClick(tag)}
                className="tag-item cursor-pointer hover:bg-blue-200"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2">
            Uploaded {new Date(image.upload_date).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="image-card relative group">
      <div className="relative">
        {imageError ? (
          <div className="w-full h-48 bg-gray-200 flex items-center justify-center cursor-pointer" onClick={() => onEdit(image.id)}>
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">🖼️</div>
              <div className="text-sm">Image not available</div>
              <div className="text-xs mt-1">{image.filename}</div>
            </div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={image.title || image.filename}
            className="w-full h-48 object-cover cursor-pointer"
            onClick={() => onEdit(image.id)}
            onError={handleImageError}
          />
        )}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(image.id);
            }}
            className="p-1 bg-white rounded-full shadow-md text-gray-600 hover:text-blue-600"
            title="Edit image"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(image.id, image.title || image.filename);
            }}
            className="p-1 bg-white rounded-full shadow-md text-gray-600 hover:text-red-600"
            title="Delete image"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2">
          {image.title || image.filename}
        </h3>
        {image.description && (
          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
            {image.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mb-2">
          {image.tags?.map(tag => (
            <span
              key={tag}
              onClick={() => onTagClick(tag)}
              className="tag-item cursor-pointer hover:bg-blue-200"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="text-gray-500 text-xs">
          {new Date(image.upload_date).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default ImageGallery; 