import React, { useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { apiCall } from '../utils/apiConfig';

const SimpleImageGallery = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Loading images...');
      const response = await apiCall('/api/images?limit=20');
      
      if (!response.ok) {
        throw new Error(`Failed to load images: ${response.status}`);
      }
      
      const data = await response.json();
      const imageList = Array.isArray(data) ? data : data.images || [];
      
      console.log(`✅ Loaded ${imageList.length} images`);
      console.log('📊 First image:', imageList[0]);
      
      setImages(imageList);
      
    } catch (err) {
      console.error('❌ Error loading images:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="text-red-500 mb-4">❌ Error loading images</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadImages}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            <RefreshCw className="h-4 w-4 inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600">No images found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Simple Image Gallery</h1>
        <p className="text-gray-600">Showing {images.length} images</p>
        <button
          onClick={loadImages}
          className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
        >
          <RefreshCw className="h-3 w-3 inline mr-1" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {images.map((image) => (
          <div key={image.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="aspect-square bg-gray-100">
              <img
                src={`https://snaptag.up.railway.app/api/images/${image.id}/direct`}
                alt={image.filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.log(`❌ Image failed to load: ${image.filename}`);
                  // Try alternative URL formats
                  if (e.target.src.includes('/direct')) {
                    e.target.src = `https://snaptag.up.railway.app/api/images/${image.id}`;
                  } else if (!e.target.src.includes('placeholder')) {
                    e.target.src = '/api/placeholder-image.jpg';
                  }
                }}
                onLoad={() => {
                  console.log(`✅ Image loaded: ${image.filename}`);
                }}
              />
            </div>
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 truncate">{image.filename}</h3>
              <p className="text-xs text-gray-500 mt-1">
                {image.tags && image.tags.length > 0 ? `${image.tags.length} tags` : 'No tags'}
              </p>
              {image.url && (
                <p className="text-xs text-green-600 mt-1">✅ Has URL</p>
              )}
              {!image.url && (
                <p className="text-xs text-red-600 mt-1">❌ No URL</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimpleImageGallery;
