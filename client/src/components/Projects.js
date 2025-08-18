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
          
          // Show which tags actually have images
          console.log('📊 Tags with image counts:', tagsData.topTags?.map(t => `${t.name}: ${t.image_count} images`));
        }
      } catch (error) {
        console.error('Failed to get tags debug info:', error);
      }
      
      // Load images for each project
      const imagePromises = projects.map(async (project) => {
        try {
          console.log(`🔍 Searching for ALL Archier project images (WIP and complete)...`);
          
          // Search for 'archier' tag to get ALL project images (WIP and complete)
          const response = await apiCall('/api/images/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tags: ['archier']
            })
          });
          
          if (response.ok) {
            const images = await response.json();
            console.log(`✅ Found ${images?.length || 0} images for ${project.name}`);
            console.log(`📊 Sample image:`, images?.[0]);
            return { projectId: project.id, images: images || [] };
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
          {/* Project Images Grid - Match Gallery Layout */}
          {activeImages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {activeImages.map((image) => {
                // Helper functions to match gallery behavior
                const getImageType = () => {
                  const tags = image.tags || [];
                  if (tags.includes('archier')) return 'Archier';
                  
                  // Only classify as Texture if there's an explicit 'texture' or 'materials' tag
                  const hasTextureContext = tags.some(tag => ['materials', 'texture'].includes(tag.toLowerCase()));
                  if (hasTextureContext) return 'Texture';
                  
                  // Only classify as Precedent if there's an explicit 'precedent' tag
                  const hasPrecedentTag = tags.some(tag => tag.toLowerCase() === 'precedent');
                  if (hasPrecedentTag) return 'Precedent';
                  
                  // If no specific type tag, return 'General'
                  return 'General';
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
                    const precedentCategories = ['art', 'bathrooms', 'details', 'doors', 'exteriors', 'furniture', 'general', 'interiors', 'joinery', 'kitchens', 'landscape', 'lighting', 'spatial', 'stairs', 'structure'];
                    const categoryTag = tags.find(tag => precedentCategories.includes(tag.toLowerCase()));
                    return categoryTag ? categoryTag.charAt(0).toUpperCase() + categoryTag.slice(1) : 'General';
                  }
                  
                  // For 'General' type, try to find the most relevant category from any tag
                  const allCategories = ['art', 'bathrooms', 'details', 'doors', 'exteriors', 'furniture', 'general', 'interiors', 'joinery', 'kitchens', 'landscape', 'lighting', 'spatial', 'stairs', 'structure', 'brick', 'carpet', 'concrete', 'fabric', 'metal', 'stone', 'tile', 'wood'];
                  const categoryTag = tags.find(tag => allCategories.includes(tag.toLowerCase()));
                  return categoryTag ? categoryTag.charAt(0).toUpperCase() + categoryTag.slice(1) : 'Uncategorised';
                };

                return (
                  <div key={image.id} className="relative group cursor-pointer">
                    <div className="bg-white overflow-hidden shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 aspect-square">
                      <div className="relative w-full h-full overflow-hidden">
                        <img
                          src={image.url || '/api/placeholder-image.jpg'}
                          alt={image.filename}
                          loading="lazy"
                          className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.target.src = '/api/placeholder-image.jpg';
                          }}
                        />
                        
                        {/* Hover Overlay - Match Gallery Style Exactly */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                          <div className="p-4 text-white">
                            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color: '#C9D468'}}>
                              {getImageType()}
                            </div>
                            <div className="text-sm font-medium text-white/90">
                              {getCategory()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
