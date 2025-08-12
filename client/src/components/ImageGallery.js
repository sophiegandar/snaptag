import React, { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Trash2, Edit, RefreshCw, AlertTriangle, Tag, Plus, CheckCircle, Download, Lightbulb, Check, X } from 'lucide-react';
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
  
  // Gallery selection state
  const [selectedGalleryImages, setSelectedGalleryImages] = useState([]);
  const [galleryQuickTags, setGalleryQuickTags] = useState('');
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [imageSuggestions, setImageSuggestions] = useState({});
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);

  useEffect(() => {
    loadImages();
    loadUntaggedImages();
    
    // Set up polling for real-time updates every 5 minutes (reduced frequency)
    const pollInterval = setInterval(() => {
      // Only poll if enabled, no current filters, not loading, and no selections active
      if (pollingEnabled && Object.keys(currentFilters).length === 0 && !loading && selectedGalleryImages.length === 0) {
        console.log('🔄 Polling for new images...');
        loadImages(currentFilters);
        loadUntaggedImages();
      }
    }, 300000); // Increased to 5 minutes to reduce server load and prevent interruptions
    
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
      setUpdatingTags(true);
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
        
        // Efficiently update state instead of full reload
        // Remove tagged images from untagged list
        setUntaggedImages(prev => prev.filter(img => !selectedUntagged.includes(img.id)));
        
        // Update main gallery images with new tags and paths
        if (result.stats && result.stats.processedImages) {
          setImages(prev => prev.map(img => {
            const updatedImg = result.stats.processedImages.find(processed => processed.id === img.id);
            if (updatedImg) {
              return {
                ...img,
                tags: [...new Set([...(img.tags || []), ...tags])], // Merge tags
                dropbox_path: updatedImg.newPath || img.dropbox_path,
                filename: updatedImg.newFilename || img.filename
              };
            }
            return img;
          }));
        } else {
          // Fallback: just add tags to selected images
          setImages(prev => prev.map(img => {
            if (selectedUntagged.includes(img.id)) {
              return {
                ...img,
                tags: [...new Set([...(img.tags || []), ...tags])]
              };
            }
            return img;
          }));
        }
        
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
      setUpdatingTags(false);
    }
  };

  // Gallery selection functions
  const toggleGalleryImageSelection = (imageId) => {
    // Temporarily disable polling when user is actively selecting
    setPollingEnabled(false);
    setTimeout(() => setPollingEnabled(true), 30000); // Re-enable after 30 seconds of inactivity
    
    setSelectedGalleryImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllGalleryImages = () => {
    setSelectedGalleryImages(images.map(img => img.id));
  };

  const clearGallerySelection = () => {
    setSelectedGalleryImages([]);
    setGalleryQuickTags('');
  };

  const applyGalleryQuickTags = async () => {
    if (selectedGalleryImages.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    if (!galleryQuickTags.trim()) {
      toast.error('Please enter at least one tag');
      return;
    }

    const tags = galleryQuickTags.split(',').map(tag => tag.trim()).filter(Boolean);
    
    try {
      setUpdatingTags(true);
      const response = await apiCall('/api/batch/apply-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds: selectedGalleryImages,
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
        
        // Efficiently update state instead of full reload
        // Remove newly tagged images from untagged list if they were untagged
        setUntaggedImages(prev => prev.filter(img => !selectedGalleryImages.includes(img.id)));
        
        // Update main gallery images with new tags and paths
        if (result.stats && result.stats.processedImages) {
          setImages(prev => prev.map(img => {
            const updatedImg = result.stats.processedImages.find(processed => processed.id === img.id);
            if (updatedImg) {
              return {
                ...img,
                tags: [...new Set([...(img.tags || []), ...tags])], // Merge tags
                dropbox_path: updatedImg.newPath || img.dropbox_path,
                filename: updatedImg.newFilename || img.filename
              };
            }
            return img;
          }));
        } else {
          // Fallback: just add tags to selected images
          setImages(prev => prev.map(img => {
            if (selectedGalleryImages.includes(img.id)) {
              return {
                ...img,
                tags: [...new Set([...(img.tags || []), ...tags])]
              };
            }
            return img;
          }));
        }
        
        // Clear selections
        setSelectedGalleryImages([]);
        setGalleryQuickTags('');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Error applying gallery quick tags:', error);
      toast.error('Failed to apply tags');
    } finally {
      setUpdatingTags(false);
    }
  };

  const downloadSelectedImages = async () => {
    if (selectedGalleryImages.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    try {
      setLoading(true);
      
      // Get current search filters to pass to download
      const searchFilters = {
        ...currentFilters,
        // Override with only selected images by using their IDs
        imageIds: selectedGalleryImages
      };

      const response = await apiCall('/api/images/download-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchFilters,
          filename: `snaptag-selection-${new Date().toISOString().split('T')[0]}.zip`
        })
      });

      if (response.ok) {
        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snaptag-selection-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success(`Downloaded ${selectedGalleryImages.length} images as ZIP file`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to download images');
      }
    } catch (error) {
      console.error('Error downloading images:', error);
      toast.error('Failed to download images');
    } finally {
      setLoading(false);
    }
  };

  // Load tag suggestions for untagged images
  const loadTagSuggestions = async () => {
    if (untaggedImages.length === 0) return;
    
    try {
      setLoadingSuggestions(true);
      
      const imageIds = untaggedImages.map(img => img.id);
      const response = await apiCall('/api/images/bulk-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds })
      });
      
      const result = await response.json();
      if (result.success) {
        setImageSuggestions(result.suggestions);
        console.log(`🤖 Loaded suggestions for ${Object.keys(result.suggestions).length} images`);
      }
    } catch (error) {
      console.error('Error loading tag suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Apply suggested tags to an image
  const applySuggestedTags = async (imageId, tags) => {
    try {
      const response = await apiCall('/api/batch/apply-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds: [imageId],
          tags: tags
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(`Applied ${tags.length} tag(s) to image`);
        
        // Efficiently update state instead of full reload
        // Remove image from untagged list
        setUntaggedImages(prev => prev.filter(img => img.id !== imageId));
        
        // Update main gallery images with new tags
        if (result.stats && result.stats.processedImages) {
          const updatedImg = result.stats.processedImages.find(processed => processed.id === imageId);
          if (updatedImg) {
            setImages(prev => prev.map(img => {
              if (img.id === imageId) {
                return {
                  ...img,
                  tags: [...new Set([...(img.tags || []), ...tags])],
                  dropbox_path: updatedImg.newPath || img.dropbox_path,
                  filename: updatedImg.newFilename || img.filename
                };
              }
              return img;
            }));
          }
        } else {
          // Fallback: just add tags
          setImages(prev => prev.map(img => {
            if (img.id === imageId) {
              return {
                ...img,
                tags: [...new Set([...(img.tags || []), ...tags])]
              };
            }
            return img;
          }));
        }
        
        // Clear suggestions for this image
        setImageSuggestions(prev => {
          const updated = { ...prev };
          delete updated[imageId];
          return updated;
        });
        
      } else {
        toast.error(result.error || 'Failed to apply tags');
      }
    } catch (error) {
      console.error('Error applying suggested tags:', error);
      toast.error('Failed to apply tags');
    }
  };

  // Dismiss suggestions for an image
  const dismissSuggestions = (imageId) => {
    setImageSuggestions(prev => {
      const updated = { ...prev };
      delete updated[imageId];
      return updated;
    });
  };

  const manualRefresh = async () => {
    toast.info('Refreshing images...');
    await loadImages(currentFilters);
    await loadUntaggedImages();
    toast.success('Images refreshed');
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

  return (
    <div className="space-y-6">
      {/* Tag Update State */}
      {updatingTags && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          Updating tags...
        </div>
      )}

      {/* Advanced Search Interface */}
      <AdvancedSearch onSearch={handleAdvancedSearch} initialFilters={currentFilters} />

      {loading ? (
        /* Loading State */
        <div className="flex justify-center items-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading images...</span>
        </div>
      ) : (
        <>
          {/* Untagged Images Section */}
          {untaggedImages.length > 0 && showUntagged && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-gray-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-800">
                      {untaggedImages.length} untagged image{untaggedImages.length !== 1 ? 's' : ''}
                    </h3>
                    <span className="ml-2 text-sm text-gray-600">
                      Need organised
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={selectAllUntagged}
                      className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearUntaggedSelection}
                      className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200"
                    >
                      Clear
                    </button>
                    <button
                      onClick={loadTagSuggestions}
                      disabled={loadingSuggestions}
                      className="flex items-center gap-1 text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200 disabled:opacity-50"
                    >
                      {loadingSuggestions ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Lightbulb className="h-3 w-3" />
                      )}
                      Get AI Suggestions
                    </button>
                    <button
                      onClick={() => setShowUntagged(false)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Hide
                    </button>
                    <span className="text-sm text-gray-600">
                      {selectedUntagged.length} selected
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Tagging */}
              {selectedUntagged.length > 0 && (
                <div className="px-6 py-3 bg-blue-50 border-b border-gray-200">
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
                      
                      {/* AI Suggestions */}
                      {imageSuggestions[image.id] && imageSuggestions[image.id].length > 0 && (
                        <div className="absolute top-2 left-2 right-2">
                          <div className="bg-white/90 backdrop-blur-sm rounded-md p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1">
                                <Lightbulb className="h-3 w-3 text-blue-500" />
                                <span className="text-xs font-medium text-gray-700">AI Suggestions</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissSuggestions(image.id);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {imageSuggestions[image.id].slice(0, 3).map((suggestion, index) => (
                                <button
                                  key={index}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    applySuggestedTags(image.id, [suggestion.tag]);
                                  }}
                                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                  title={`${suggestion.confidence}% confidence - ${suggestion.reason}`}
                                >
                                  {suggestion.tag} ({suggestion.confidence}%)
                                </button>
                              ))}
                            </div>
                            {imageSuggestions[image.id].length > 3 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allTags = imageSuggestions[image.id]
                                    .filter(s => s.confidence > 60)
                                    .map(s => s.tag);
                                  if (allTags.length > 0) {
                                    applySuggestedTags(image.id, allTags);
                                  }
                                }}
                                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                              >
                                Apply All High Confidence
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Show Untagged Button (when hidden) */}
          {untaggedImages.length > 0 && !showUntagged && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-gray-600 mr-2" />
                  <span className="text-gray-800">
                    {untaggedImages.length} untagged image{untaggedImages.length !== 1 ? 's' : ''} need attention
                  </span>
                </div>
                <button
                  onClick={() => setShowUntagged(true)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Show untagged images
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
                onClick={manualRefresh}
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

          {/* Gallery Selection Bar */}
          {selectedGalleryImages.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-blue-800 font-medium">
                    {selectedGalleryImages.length} image{selectedGalleryImages.length !== 1 ? 's' : ''} selected
                  </span>
                  <input
                    type="text"
                    value={galleryQuickTags}
                    onChange={(e) => setGalleryQuickTags(e.target.value)}
                    placeholder="Add tags: archier, facade, glazing..."
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ width: '300px' }}
                  />
                  <button
                    onClick={applyGalleryQuickTags}
                    disabled={loading || !galleryQuickTags.trim()}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Apply Tags
                  </button>
                  <button
                    onClick={downloadSelectedImages}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download ZIP
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={selectAllGalleryImages}
                    className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearGallerySelection}
                    className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200"
                  >
                    Unselect All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Images Grid */}
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
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
              : 'space-y-4'
            }>
              {images.map(image => (
                <ImageCard 
                  key={image.id} 
                  image={image} 
                  viewMode={viewMode}
                  onTagClick={handleTagClick}
                  onDelete={deleteImage}
                  onEdit={(id) => navigate(`/image/${id}`)}
                  isSelected={selectedGalleryImages.includes(image.id)}
                  onSelect={() => toggleGalleryImageSelection(image.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ImageCard = ({ image, viewMode, onTagClick, onDelete, onEdit, isSelected, onSelect }) => {
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
    // Don't retry automatically to prevent infinite reload loops
    // The user can refresh the page manually if needed
  };

  if (viewMode === 'list') {
    return (
      <div className={`bg-white p-4 rounded-lg shadow flex gap-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
        {/* Selection Checkbox */}
        <div className="flex items-start pt-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
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
    <div className={`image-card relative group ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Selection Checkbox */}
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded bg-white shadow"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
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