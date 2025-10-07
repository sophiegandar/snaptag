import React, { useState, useEffect } from 'react';
import { Camera, Check } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiCall } from '../utils/apiConfig';

const SimpleThumbnailSetter = () => {
  const { projectId } = useParams();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingThumbnail, setSettingThumbnail] = useState(null);
  const [project, setProject] = useState(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const response = await apiCall(`/api/projects/${projectId}`);
      if (response.ok) {
        const projectData = await response.json();
        setProject(projectData);
        loadImages(projectData.name);
      }
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    }
  };

  const loadImages = async (projectName) => {
    try {
      setLoading(true);
      // Get ALL images for this project - simple approach
      const response = await apiCall(`/api/images?limit=100`);
      
      if (response.ok) {
        const data = await response.json();
        const projectImages = Array.isArray(data) ? data : data.images || [];
        
        // Filter for this specific project
        const filtered = projectImages.filter(img => 
          img.tags && img.tags.some(tag => 
            tag.toLowerCase().includes(projectName.toLowerCase().replace(/\s+/g, ''))
          )
        );
        
        setImages(filtered.slice(0, 12)); // Show first 12 images
        console.log(`✅ Loaded ${filtered.length} images for ${projectName}`);
      }
    } catch (error) {
      console.error('Error loading images:', error);
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const setThumbnail = async (imageId, imageName) => {
    try {
      setSettingThumbnail(imageId);
      
      const response = await apiCall(`/api/projects/${projectId}/thumbnail`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId })
      });
      
      if (response.ok) {
        toast.success(`✅ Set "${imageName}" as thumbnail for ${project.name}`);
        setTimeout(() => window.location.href = '/projects', 1000); // Go back to projects
      } else {
        throw new Error('Failed to set thumbnail');
      }
    } catch (error) {
      console.error('Error setting thumbnail:', error);
      toast.error('Failed to set thumbnail');
    } finally {
      setSettingThumbnail(null);
    }
  };

  if (loading || !project) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading images...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Camera className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No images found for {project.name}</p>
        <p className="text-sm mt-2">Upload some images first, then return here to set a thumbnail.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Set Thumbnail for {project.name}
        </h3>
        <p className="text-sm text-gray-600">
          Click on any image below to set it as the project thumbnail
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative group cursor-pointer bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200"
            onClick={() => setThumbnail(image.id, image.filename)}
          >
            <div className="aspect-square bg-gray-100">
              <img
                src={image.url || `/api/images/${image.id}/url`}
                alt={image.filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = '/api/placeholder-image.jpg';
                }}
              />
            </div>
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {settingThumbnail === image.id ? (
                  <div className="bg-white rounded-full p-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Image name */}
            <div className="p-2">
              <p className="text-xs text-gray-600 truncate">{image.filename}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimpleThumbnailSetter;
