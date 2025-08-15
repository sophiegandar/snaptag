import React, { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Trash2, Edit, RefreshCw, AlertTriangle, Tag, Plus, CheckCircle, Download, Lightbulb, Check, X, ChevronDown } from 'lucide-react';
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
  
  // Tags dropdown state
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);

  useEffect(() => {
    loadImages();
    loadUntaggedImages();
    loadAvailableTags();
    
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isTagsDropdownOpen && !event.target.closest('.tags-dropdown')) {
        setIsTagsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTagsDropdownOpen]);

  const loadImages = async (searchFilters = {}) => {
    try {
      setLoading(true);
      // Auto-dismiss AI suggestions when loading new images
      setImageSuggestions({});
      setCurrentFilters(searchFilters);
      
      console.log('🔍 Loading images with filters:', searchFilters);
      
      // Use regular endpoint for better performance when no filters
      const hasFilters = searchFilters.searchTerm || 
                        (searchFilters.tags && searchFilters.tags.length > 0) ||
                        (searchFilters.sources && searchFilters.sources.length > 0) ||
                        searchFilters.dateRange;
      
      let response;
      if (hasFilters) {
        console.log('📡 Using search endpoint (has filters)');
        response = await apiCall('/api/images/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchFilters)
        });
      } else {
        console.log('📡 Using regular endpoint (no filters)');
        response = await apiCall('/api/images');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Response not OK:', response.status, errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Images loaded successfully:', data.length, 'images');
      
      // Debug: Check URLs in received data
      const urlStats = data.map(img => ({ id: img.id, filename: img.filename, hasUrl: !!img.url, url: img.url?.substring(0, 50) }));
      console.log('🔍 URL Debug - Received data:', urlStats.slice(0, 5));
      
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

  const loadAvailableTags = async () => {
    try {
      const response = await apiCall('/api/tags');
      const tags = await response.json();
      setAvailableTags(tags.map(tag => tag.name || tag));
    } catch (error) {
      console.error('Error loading tags:', error);
    }
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
    // Move any tagged images from untagged to main gallery
    const taggedImages = untaggedImages.filter(img => 
      selectedUntagged.includes(img.id) && img.tags && img.tags.length > 0
    );
    
    if (taggedImages.length > 0) {
      // Remove tagged images from untagged list
      setUntaggedImages(prev => prev.filter(img => 
        !taggedImages.some(tagged => tagged.id === img.id)
      ));
      
      // Add tagged images to main gallery (avoid duplicates)
      setImages(prev => {
        const existingIds = new Set(prev.map(img => img.id));
        const newImages = taggedImages.filter(img => !existingIds.has(img.id));
        return [...newImages, ...prev]; // Add to beginning for visibility
      });
      
      toast.success(`${taggedImages.length} tagged image${taggedImages.length !== 1 ? 's' : ''} moved to main gallery`);
    }
    
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
        
        // Show info about retained selection (matching gallery behavior)
        toast.info(`${selectedUntagged.length} image(s) still selected - add more tags or "Unselect All"`, { autoClose: 3000 });
        
        // Efficiently update state instead of full reload
        // Remove newly tagged images from untagged list if they were untagged
        // (This will happen when user clicks "Unselect All")
        
        // Update untagged images with new tags (so clearSelection can detect them)
        setUntaggedImages(prev => prev.map(img => {
          if (selectedUntagged.includes(img.id)) {
            return {
              ...img,
              tags: [...new Set([...(img.tags || []), ...tags])],
              url: img.url // Preserve the URL
            };
          }
          return img;
        }));
        
        // Update main gallery images with new tags and paths
        if (result.stats && result.stats.processedImages) {
          setImages(prev => prev.map(img => {
            const updatedImg = result.stats.processedImages.find(processed => processed.id === img.id);
            if (updatedImg) {
              return {
                ...img,
                tags: [...new Set([...(img.tags || []), ...tags])], // Merge tags
                dropbox_path: updatedImg.newPath || img.dropbox_path,
                filename: updatedImg.newFilename || img.filename,
                url: img.url // Preserve the URL
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
                tags: [...new Set([...(img.tags || []), ...tags])],
                url: img.url // Preserve the URL
              };
            }
            return img;
          }));
        }
        
        // Keep selections but clear tag input for next batch (matching gallery behavior)
        // setSelectedUntagged([]);  // Don't clear selection
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
    
    setSelectedGalleryImages(prev => {
      const newSelection = prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId];
      
      // Auto-dismiss AI suggestions if no images are selected
      if (newSelection.length === 0) {
        setImageSuggestions({});
      }
      
      return newSelection;
    });
  };

  const selectAllGalleryImages = () => {
    setSelectedGalleryImages(images.map(img => img.id));
  };

  const clearGallerySelection = () => {
    setSelectedGalleryImages([]);
    setGalleryQuickTags('');
    // Auto-dismiss AI suggestions when clearing selection
    setImageSuggestions({});
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
        
        // Show info about retained selection
        toast.info(`${selectedGalleryImages.length} image(s) still selected - add more tags or "Unselect All"`, { autoClose: 3000 });
        
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
                filename: updatedImg.newFilename || img.filename,
                url: img.url // Preserve the URL
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
                tags: [...new Set([...(img.tags || []), ...tags])],
                url: img.url // Preserve the URL
              };
            }
            return img;
          }));
        }
        
        // Keep selections but clear tag input for next batch
        // setSelectedGalleryImages([]);  // Don't clear selection
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
    if (untaggedImages.length === 0) {
      toast.info('No untagged images to analyze');
      return;
    }

    try {
      setLoadingSuggestions(true);
      const untaggedIds = untaggedImages.map(img => img.id);
      
      const response = await apiCall('/api/images/bulk-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageIds: untaggedIds,
          includeTagged: false  // Only untagged images for untagged section
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setImageSuggestions(result.suggestions);
        toast.success(`Generated suggestions for ${Object.keys(result.suggestions).length} images`);
      } else {
        toast.error('Failed to generate suggestions');
      }
    } catch (error) {
      console.error('Error loading tag suggestions:', error);
      toast.error('Failed to load suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadGallerySelectionSuggestions = async () => {
    if (selectedGalleryImages.length === 0) {
      toast.error('Please select images first');
      return;
    }

    try {
      setLoadingSuggestions(true);
      
      const response = await apiCall('/api/images/bulk-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageIds: selectedGalleryImages,
          includeTagged: true  // Allow suggestions for already-tagged images
        })
      });
      
      const result = await response.json();
      if (result.success) {
        // console.log('🤖 AI Suggestions received:', result.suggestions);
        setImageSuggestions(prev => ({ ...prev, ...result.suggestions }));
        const suggestionCount = Object.keys(result.suggestions).length;
        
        // Debug: Log selected images vs suggestion images (disabled to reduce console noise)
        // console.log(`📋 Selected images:`, selectedGalleryImages);
        // console.log(`🤖 Suggestion image IDs:`, Object.keys(result.suggestions));
        
        toast.success(`Generated suggestions for ${suggestionCount} of ${selectedGalleryImages.length} selected image${selectedGalleryImages.length !== 1 ? 's' : ''}`);
      } else {
        toast.error('Failed to generate suggestions');
      }
    } catch (error) {
      console.error('Error loading gallery selection suggestions:', error);
      toast.error('Failed to load suggestions');
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
                  filename: updatedImg.newFilename || img.filename,
                url: img.url // Preserve the URL
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
                      placeholder="Enter tags (comma-separated): precedents, materials etc"
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
                          <div className={`text-white rounded-full p-1 ${
                            image.tags && image.tags.length > 0 
                              ? 'bg-green-500' 
                              : 'bg-blue-500'
                          }`}>
                            <CheckCircle className="h-3 w-3" />
                          </div>
                        </div>
                      )}
                      
                      {/* Show tags indicator if image has been tagged */}
                      {image.tags && image.tags.length > 0 && (
                        <div className="absolute top-2 left-2">
                          <div className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                            {image.tags.length} tag{image.tags.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-white text-xs font-medium truncate">
                          {image.filename}
                        </p>
                      </div>
                      
                      {/* AI Suggestions */}
                      {/* AI Suggestions debugging disabled */}
                      {imageSuggestions[image.id] && imageSuggestions[image.id].length > 0 && (
                        <div className="absolute top-2 left-2 right-2">
                          <div className="bg-white/90 backdrop-blur-sm rounded-md p-2 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1">
                                <Lightbulb className="h-3 w-3 text-blue-500" />
                                <span className="text-xs font-medium text-gray-700">Suggest Tags</span>
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

          {/* Tags Filter Dropdown */}
          <div className="relative mb-4 tags-dropdown">
            <button
              onClick={() => setIsTagsDropdownOpen(!isTagsDropdownOpen)}
              className="flex items-center space-x-3 px-6 py-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm min-w-[200px] justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                  <Tag className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">
                    {currentFilters.tags?.length > 0 ? `${currentFilters.tags.length} tag${currentFilters.tags.length > 1 ? 's' : ''}` : 'Categories'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {currentFilters.tags?.length > 0 ? currentFilters.tags.slice(0, 2).join(', ') + (currentFilters.tags.length > 2 ? '...' : '') : 'Filter by tags'}
                  </div>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isTagsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isTagsDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto min-w-[400px]">
                <div className="p-4">
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-900 mb-2">Categories</h3>
                  </div>
                  
                  <div 
                    className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 rounded-lg cursor-pointer mb-1"
                    onClick={() => {
                      handleAdvancedSearch({...currentFilters, tags: []});
                      setIsTagsDropdownOpen(false);
                    }}
                  >
                    <div className="w-6 h-6 border-2 border-dashed border-gray-400 rounded-md flex items-center justify-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Categories</div>
                      <div className="text-sm text-gray-500">Show all images</div>
                    </div>
                  </div>
                  
                  {availableTags.map((tag) => {
                    const isSelected = currentFilters.tags?.includes(tag);
                    return (
                      <div
                        key={tag}
                        className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 rounded-lg cursor-pointer mb-1"
                        onClick={() => {
                          const newTags = isSelected
                            ? currentFilters.tags?.filter(t => t !== tag) || []
                            : [...(currentFilters.tags || []), tag];
                          handleAdvancedSearch({...currentFilters, tags: newTags});
                        }}
                      >
                        <div className={`w-6 h-6 border-2 rounded-md flex items-center justify-center ${
                          isSelected 
                            ? 'bg-blue-500 border-blue-500' 
                            : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <Check className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 capitalize">{tag}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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

          {/* AI Suggestions Panel - Appears above selection bar */}
          {Object.keys(imageSuggestions).length > 0 && (
            <div className="fixed bottom-20 left-0 right-0 bg-green-50 border-t border-green-200 p-4 shadow-lg z-40">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-green-600" />
                    <span className="text-green-800 font-medium">AI Tag Suggestions</span>
                  </div>
                  <button
                    onClick={() => setImageSuggestions({})}
                    className="text-green-600 hover:text-green-800 p-1"
                    title="Dismiss all suggestions"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {Object.entries(imageSuggestions).map(([imageId, suggestions]) => {
                    const image = images.find(img => img.id.toString() === imageId);
                    return (
                      <div key={imageId} className="bg-white p-3 rounded-lg border border-green-200">
                        {/* Image filename header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-green-700 font-medium">
                            {image?.filename || `Image ${imageId}`}
                          </span>
                          <span className="text-xs text-gray-500">
                            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        {/* Current Tags Display */}
                        <div className="mb-3 p-2 bg-blue-50 rounded border-l-3 border-blue-400">
                          <div className="flex items-center mb-1">
                            <svg className="h-3 w-3 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span className="text-xs font-medium text-blue-600">Current Tags:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {image?.tags && image.tags.length > 0 ? (
                              image.tags.map((tag, index) => (
                                <span key={index} className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 italic">No tags yet</span>
                            )}
                          </div>
                        </div>
                        
                        {/* AI Suggestions */}
                        <div className="flex flex-wrap gap-1">
                          {suggestions.slice(0, 5).map((suggestion, index) => {
                            const isAlreadyTagged = image?.tags?.includes(suggestion.tag);
                            return (
                              <button
                                key={index}
                                onClick={() => applySuggestedTags(parseInt(imageId), [suggestion.tag])}
                                disabled={isAlreadyTagged}
                                className={`text-xs px-2 py-1 rounded transition-colors border ${
                                  isAlreadyTagged 
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                                    : 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                }`}
                                title={isAlreadyTagged ? 'Already tagged' : `${suggestion.confidence}% confidence - ${suggestion.reason}`}
                              >
                                {suggestion.tag} ({suggestion.confidence}%)
                                {isAlreadyTagged && ' ✓'}
                              </button>
                            );
                          })}
                          {suggestions.length > 5 && (
                            <button
                              onClick={() => {
                                const allTags = suggestions
                                  .filter(s => s.confidence > 60 && !image?.tags?.includes(s.tag))
                                  .map(s => s.tag);
                                if (allTags.length > 0) {
                                  applySuggestedTags(parseInt(imageId), allTags);
                                }
                              }}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                            >
                              Apply All New ({suggestions.filter(s => s.confidence > 60 && !image?.tags?.includes(s.tag)).length})
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Gallery Selection Bar - Fixed at bottom */}
          {selectedGalleryImages.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-blue-50 border-t border-blue-200 p-4 shadow-lg z-50">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-blue-800 font-medium">
                      {selectedGalleryImages.length} image{selectedGalleryImages.length !== 1 ? 's' : ''} selected
                    </span>
                    <input
                      type="text"
                      value={galleryQuickTags}
                      onChange={(e) => setGalleryQuickTags(e.target.value)}
                      placeholder="Add tags: precedents, materials etc"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ width: '300px' }}
                      onKeyPress={(e) => e.key === 'Enter' && applyGalleryQuickTags()}
                    />
                    <button
                      onClick={applyGalleryQuickTags}
                      disabled={loading || !galleryQuickTags.trim()}
                      className="bg-stone-700 text-white px-3 py-2 rounded-md hover:bg-stone-800 disabled:opacity-50 flex items-center border border-stone-600 text-sm"
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Apply Tags
                    </button>
                    <button
                      onClick={loadGallerySelectionSuggestions}
                      disabled={loadingSuggestions || selectedGalleryImages.length === 0}
                      className="bg-stone-600 text-stone-100 px-3 py-2 rounded-md hover:bg-stone-700 disabled:opacity-50 flex items-center border border-stone-500 text-sm"
                      style={{backgroundColor: loadingSuggestions || selectedGalleryImages.length === 0 ? '#6b7280' : '#57534e'}}
                    >
                      {loadingSuggestions ? (
                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                      ) : (
                        <Lightbulb className="h-3 w-3 mr-2" />
                      )}
                      Suggest Tags
                    </button>
                    <button
                      onClick={downloadSelectedImages}
                      disabled={loading}
                      className="bg-olive-700 text-white px-3 py-2 rounded-md hover:bg-olive-800 disabled:opacity-50 flex items-center border border-olive-600 text-sm"
                      style={{backgroundColor: loading ? '#6b7280' : '#6b7249', borderColor: '#84823a'}}
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
            </div>
          )}

          {/* Add bottom padding when sticky bar is visible */}
          {selectedGalleryImages.length > 0 && (
            <div className="h-20"></div>
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
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-center'
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
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Reset error state when image changes
    setImageError(false);
    
    // Debug URL setting - temporarily disable to reduce console noise
    // if (!image.url) {
    //   console.log('🚨 Empty URL for image:', { id: image.id, filename: image.filename, url: image.url, dropbox_path: image.dropbox_path });
    // }
    
    setImageUrl(image.url || `${window.location.origin}/api/placeholder-image.jpg`);
  }, [image]);

  const handleImageError = () => {
    // Completely suppress console warnings - failures handled gracefully with placeholders
    setImageError(true);
  };

  // Helper functions to extract metadata
  const getImageType = () => {
    const tags = image.tags || [];
    if (tags.includes('archier')) return 'Archier';
    
    // Only classify as Texture if there's an explicit 'texture' or 'materials' tag
    const hasTextureContext = tags.some(tag => ['materials', 'texture'].includes(tag.toLowerCase()));
    if (hasTextureContext) return 'Texture';
    
    // Only classify as Precedent if there's an explicit 'precedent' tag
    const hasPrecedentTag = tags.some(tag => tag.toLowerCase() === 'precedent');
    if (hasPrecedentTag) return 'Precedent';
    
    // If no specific type tag, return 'General' or based on most prominent tag
    return 'General';
  };

  const getProject = () => {
    const tags = image.tags || [];
    if (!tags.includes('archier')) return null;
    
    const projects = ['yandoit', 'ballarat', 'melbourne', 'geelong', 'bendigo'];
    const projectTag = tags.find(tag => projects.includes(tag.toLowerCase()));
    return projectTag ? projectTag.charAt(0).toUpperCase() + projectTag.slice(1) : null;
  };

  const getCategory = () => {
    const tags = image.tags || [];
    const type = getImageType();
    
    if (type === 'Archier') {
      const archierCategories = ['complete', 'wip'];
      const categoryTag = tags.find(tag => archierCategories.includes(tag.toLowerCase()));
      return categoryTag ? categoryTag.charAt(0).toUpperCase() + categoryTag.slice(1) : 'Complete';
    }
    
    if (type === 'Texture') {
      const materialCategories = ['brick', 'carpet', 'concrete', 'fabric', 'general', 'landscape', 'metal', 'stone', 'tile', 'wood'];
      const categoryTag = tags.find(tag => materialCategories.includes(tag.toLowerCase()));
      return categoryTag ? categoryTag.charAt(0).toUpperCase() + categoryTag.slice(1) : 'General';
    }
    
    if (type === 'Precedent') {
      // Precedent categories
      const precedentCategories = ['art', 'bathrooms', 'details', 'doors', 'exteriors', 'furniture', 'general', 'interiors', 'joinery', 'kitchens', 'landscape', 'lighting', 'spatial', 'stairs', 'structure'];
      const categoryTag = tags.find(tag => precedentCategories.includes(tag.toLowerCase()));
      return categoryTag ? categoryTag.charAt(0).toUpperCase() + categoryTag.slice(1) : 'General';
    }
    
    // For 'General' type, try to find the most relevant category from any tag
    const allCategories = ['art', 'bathrooms', 'details', 'doors', 'exteriors', 'furniture', 'general', 'interiors', 'joinery', 'kitchens', 'landscape', 'lighting', 'spatial', 'stairs', 'structure', 'brick', 'carpet', 'concrete', 'fabric', 'metal', 'stone', 'tile', 'wood'];
    const categoryTag = tags.find(tag => allCategories.includes(tag.toLowerCase()));
    return categoryTag ? categoryTag.charAt(0).toUpperCase() + categoryTag.slice(1) : 'Uncategorised';
  };

  const getName = () => {
    return image.name || null; // Only return actual name, not fallbacks
  };

  const getDisplayName = () => {
    return image.name || image.title || image.filename?.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '') || 'Untitled';
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

  // Architextures.org-style grid card
  return (
    <div 
      className={`relative group cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(image.id)}
    >
      {/* Selection Checkbox - only visible on hover or when selected */}
      <div className={`absolute top-3 left-3 z-20 transition-opacity duration-200 ${isHovered || isSelected ? 'opacity-100' : 'opacity-0'}`}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded bg-white shadow-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Image Container - Fixed aspect ratio like architextures.org */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {imageError ? (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-3xl mb-2">🖼️</div>
              <div className="text-sm font-medium">Image not available</div>
            </div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={getDisplayName()}
            className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            onError={handleImageError}
          />
        )}

        {/* Hover Overlay with Type, Project, Category, Name */}
        <div className={`absolute inset-0 bg-black bg-opacity-70 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'} flex flex-col justify-end p-4`}>
          <div className="text-white">
            {/* Type */}
            <div className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-1">
              {getImageType()}
            </div>
            
            {/* Project (only for Archier) */}
            {getProject() && (
              <div className="text-xs text-gray-300 mb-1">
                <span className="font-medium">Project:</span> {getProject()}
              </div>
            )}
            
            {/* Category */}
            <div className="text-xs text-gray-300 mb-2">
              <span className="font-medium">Category:</span> {getCategory()}
            </div>
            
            {/* Name (only if manually entered) */}
            {getName() && (
              <div className="text-sm font-medium text-white truncate">
                {getName()}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons - only visible on hover */}
        <div className={`absolute top-3 right-3 flex gap-2 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(image.id);
            }}
            className="p-2 bg-white bg-opacity-90 rounded-full shadow-lg text-gray-600 hover:text-blue-600 hover:bg-white transition-colors"
            title="Edit image"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(image.id, getDisplayName());
            }}
            className="p-2 bg-white bg-opacity-90 rounded-full shadow-lg text-gray-600 hover:text-red-600 hover:bg-white transition-colors"
            title="Delete image"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageGallery; 