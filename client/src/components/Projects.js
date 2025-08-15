import React, { useState, useEffect } from 'react';
import { FolderOpen, Image as ImageIcon } from 'lucide-react';
import { apiCall } from '../utils/apiConfig';

const Projects = () => {
  const [activeTab, setActiveTab] = useState('yandoit');
  const [projectImages, setProjectImages] = useState({});
  const [loading, setLoading] = useState(true);

  // Archier project tabs - only showing Yandoit for now
  const projects = [
    { 
      id: 'yandoit', 
      name: 'Yandoit'
    }
  ];

  useEffect(() => {
    loadProjectImages();
  }, []);

  const loadProjectImages = async () => {
    try {
      setLoading(true);
      
      // First, let's check what tags actually exist in the database
      console.log('🔍 Checking what tags actually exist in database...');
      try {
        const tagsResponse = await apiCall('/api/debug/tags');
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          console.log('📊 Database tags summary:', {
            totalTags: tagsData.totalTags,
            archierTags: tagsData.archierTags,
            yandoitTags: tagsData.yandoitTags,
            topTags: tagsData.topTags?.slice(0, 10)
          });
          
          // Show exact tag names
          console.log('🔍 Exact archier tag names:', tagsData.archierTags.map(t => `"${t.name}"`));
          console.log('🔍 Exact yandoit tag names:', tagsData.yandoitTags.map(t => `"${t.name}"`));
          console.log('🔍 All tags:', tagsData.allTags?.slice(0, 20));
        }
      } catch (error) {
        console.error('Failed to get tags debug info:', error);
      }
      
      // Load images for each project
      const imagePromises = projects.map(async (project) => {
        try {
          console.log(`🔍 First, let's search for just 'archier' images...`);
          
          // First search for just 'archier' images to see what we have
          const archierResponse = await apiCall('/api/images/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tags: ['archier'] // Use lowercase as confirmed by user
            })
          });
          
          if (archierResponse.ok) {
            const archierData = await archierResponse.json();
            console.log(`📊 Found ${archierData.images?.length || 0} total 'archier' images`);
            
            // Debug: Show tags of first few archier images
            if (archierData.images && archierData.images.length > 0) {
              archierData.images.slice(0, 5).forEach(img => {
                console.log(`📋 Archier image ${img.id}: ${img.filename} - tags: [${img.tags?.join(', ') || 'none'}]`);
              });
            }
          }
          
          console.log(`🔍 Now searching for images with 'archier' AND '${project.id}'...`);
          
          // Now search for images with both 'archier' AND 'yandoit'
          const response = await apiCall('/api/images/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tags: ['archier', 'yandoit'] // Use lowercase as confirmed by user
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`✅ Found ${data.images?.length || 0} images for ${project.name}`);
            return { projectId: project.id, images: data.images || [] };
          } else {
            const errorText = await response.text();
            console.warn(`Failed to load images for ${project.name}:`, response.status, errorText);
            return { projectId: project.id, images: [] };
          }
        } catch (error) {
          console.error(`Error loading ${project.name} images:`, error);
          return { projectId: project.id, images: [] };
        }
      });

      const results = await Promise.all(imagePromises);
      
      // Convert to object for easy lookup
      const imagesByProject = {};
      results.forEach(({ projectId, images }) => {
        imagesByProject[projectId] = images;
      });
      
      setProjectImages(imagesByProject);
    } catch (error) {
      console.error('Error loading project images:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeProject = projects.find(p => p.id === activeTab);
  const activeImages = projectImages[activeTab] || [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-2">
          <FolderOpen className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Archier Projects</h1>
        </div>
        <p className="text-gray-600">Browse images from current and completed architectural projects</p>
      </div>

      {/* Project Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setActiveTab(project.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === project.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {project.name}
              {projectImages[project.id] && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {projectImages[project.id].length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        /* Loading State */
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading project images...</p>
          </div>
        </div>
      ) : (
        /* Project Content */
        <div>
          {/* Project Images Grid */}
          {activeImages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {activeImages.map((image) => (
                <div key={image.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow">
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={image.url || '/api/placeholder-image.jpg'}
                      alt={image.filename}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        e.target.src = '/api/placeholder-image.jpg';
                      }}
                    />
                    
                    {/* Overlay with filename */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-end">
                      <div className="w-full p-3 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                        <p className="text-sm font-medium truncate">{image.title || image.filename}</p>
                        {image.tags && image.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {image.tags.slice(0, 3).map((tag, index) => (
                              <span key={index} className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">
                                {tag}
                              </span>
                            ))}
                            {image.tags.length > 3 && (
                              <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">
                                +{image.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <ImageIcon className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
              <p className="text-gray-500">
                No images tagged with 'archier' and '{activeTab}' were found.
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Upload images and tag them with both 'archier' and '{activeTab}' to see them here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Projects;
