import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  CheckCircle, 
  XCircle, 
  Plus
} from 'lucide-react';
import { toast } from 'react-toastify';
import { apiCall } from '../utils/apiConfig';

const BatchProcessing = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [images, setImages] = useState([]);
  const [showImageSelector, setShowImageSelector] = useState(false);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const response = await apiCall('/api/images');
      const imagesData = await response.json();
      setImages(imagesData);
    } catch (error) {
      console.error('Error loading images:', error);
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
      const response = await apiCall('/api/batch/apply-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds: selectedImages,
          tags: tags
        })
      });
      
      const result = await response.json();
      if (result.success) {
        // Show main success message
        toast.success(result.message);
        
        // Show additional info about duplicates if any
        if (result.stats && result.stats.duplicateInfo && result.stats.duplicateInfo.length > 0) {
          const duplicateCount = result.stats.duplicateInfo.length;
          const duplicateMessage = `${duplicateCount} image(s) had duplicate tags that were skipped`;
          toast.info(duplicateMessage, { autoClose: 5000 });
          
          // Log detailed duplicate info for debugging
          console.log('📝 Duplicate tags detected:', result.stats.duplicateInfo);
        }
        
        // Show info about moved files if any
        if (result.stats && result.stats.processedImages) {
          const movedCount = result.stats.processedImages.filter(img => img.moved).length;
          if (movedCount > 0) {
            toast.info(`${movedCount} image(s) moved to new folder structure`, { autoClose: 5000 });
          }
        }
        
        setSelectedImages([]);
        setNewTagInput('');
        setShowImageSelector(false);
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



  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch Processing</h1>
        <p className="text-gray-600">
          Manage bulk operations on your image library. Process metadata, apply tags, and restore missing information.
        </p>
      </div>

      {/* Batch Tagging */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <Tag className="h-6 w-6 text-purple-500 mr-2" />
            <h3 className="text-lg font-semibold">Batch Tag Application</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Apply tags to multiple images at once. This will add tags to existing images without removing current tags.
          </p>
          <button
            onClick={() => setShowImageSelector(!showImageSelector)}
            className="w-full bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 flex items-center justify-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            {showImageSelector ? 'Hide' : 'Show'} Image Selector
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
    </div>
  );
};

export default BatchProcessing; 