import React, { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AdvancedSearch from './AdvancedSearch';

const ImageGallery = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [currentFilters, setCurrentFilters] = useState({});
  const [lastErrorTime, setLastErrorTime] = useState(0);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async (searchFilters = {}) => {
    try {
      setLoading(true);
      setCurrentFilters(searchFilters);
      
      console.log('🔍 Loading images with filters:', searchFilters);
      
      const response = await fetch('/api/images/search', {
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

  const deleteImage = async (imageId, imageName) => {
    if (!window.confirm(`Are you sure you want to delete "${imageName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/images/${imageId}`, {
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

  useEffect(() => {
    // In a real implementation, you'd get the temporary URL from the API
    setImageUrl(image.url || '/api/placeholder-image.jpg');
  }, [image]);

  if (viewMode === 'list') {
    return (
      <div className="bg-white p-4 rounded-lg shadow flex gap-4">
        <img
          src={imageUrl}
          alt={image.title || image.filename}
          className="w-24 h-24 object-cover rounded cursor-pointer"
          onClick={() => onEdit(image.id)}
        />
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
        <img
          src={imageUrl}
          alt={image.title || image.filename}
          className="w-full h-48 object-cover cursor-pointer"
          onClick={() => onEdit(image.id)}
        />
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