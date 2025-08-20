import React, { useState, useEffect } from 'react';
import { FolderOpen, Image as ImageIcon, Plus, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiCall } from '../utils/apiConfig';
import { useMode } from '../context/ModeContext';

const Projects = () => {
  const { canEdit } = useMode();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'complete', 'current', 'project'
  const [activeProject, setActiveProject] = useState(null);
  const [activeProjectTab, setActiveProjectTab] = useState('photos'); // 'precedent', 'texture', 'photos'
  const [projectImages, setProjectImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [completeProjects, setCompleteProjects] = useState([]);
  const [currentProjects, setCurrentProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [forceRefresh, setForceRefresh] = useState(0);

  // Default projects that auto-generate from tags
  const defaultCompleteProjects = [
    { 
      id: 'yandoit', 
      name: 'Yandoit',
      tags: ['archier', 'yandoit', 'complete'],
      type: 'complete'
    }
  ];

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    // Only handle URL routing after projects are loaded
    if (!loading) {
      handleUrlRouting();
    }
  }, [location.pathname, params, loading, currentProjects, completeProjects]);

  const handleUrlRouting = () => {
    const path = location.pathname;
    const projectId = params.projectId;
    
    console.log(`🌐 URL ROUTING: path=${path}, projectId=${projectId}`);
    
    if (path === '/projects/complete') {
      console.log(`🌐 Setting view to complete`);
      setViewMode('complete');
    } else if (path.startsWith('/projects/complete/') && projectId) {
      console.log(`🌐 Loading complete project: ${projectId}`);
      const project = completeProjects.find(p => p.id === projectId) || defaultCompleteProjects.find(p => p.id === projectId);
      if (project) {
        setActiveProject(project);
        setViewMode('project');
        loadProjectImages(project, 'photos');
      }
    } else if (path === '/projects/current') {
      console.log(`🌐 Setting view to current`);
      setViewMode('current');
    } else if (path.startsWith('/projects/current/') && projectId) {
      console.log(`🌐 Loading current project: ${projectId}`);
      console.log(`🌐 Available current projects:`, currentProjects.map(p => p.id));
      const project = currentProjects.find(p => p.id === projectId);
      if (project) {
        console.log(`🌐 Found project:`, project);
        setActiveProject(project);
        setViewMode('project');
        setActiveProjectTab('precedent'); // Default to precedent for current projects
        loadProjectImages(project, 'precedent');
      } else {
        console.log(`🌐 Project ${projectId} not found in current projects`);
        
        // Try to create the project if it doesn't exist (for URL sharing)
        if (projectId === 'couvreur') {
          console.log(`🌐 Creating missing Couvreur project`);
          const newProject = {
            id: 'couvreur',
            name: 'Couvreur',
            tags: ['couvreur'],
            type: 'current',
            created: new Date().toISOString()
          };
          
          const updatedCurrentProjects = [...currentProjects, newProject];
          setCurrentProjects(updatedCurrentProjects);
          localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedCurrentProjects));
          
          setActiveProject(newProject);
          setViewMode('project');
          setActiveProjectTab('precedent');
          loadProjectImages(newProject, 'precedent');
        } else {
          // If project not found, redirect to overview
          navigate('/projects');
        }
      }
    } else {
      console.log(`🌐 Setting view to overview`);
      setViewMode('overview');
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      
      // Load complete projects (those with 'complete' tag)
      setCompleteProjects(defaultCompleteProjects);
      
      // Load current projects from localStorage or API (for now, use localStorage)
      const savedCurrentProjects = localStorage.getItem('snaptag-current-projects');
      if (savedCurrentProjects) {
        setCurrentProjects(JSON.parse(savedCurrentProjects));
      }
      
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectImages = async (project, tab = 'photos', stage = '', room = '') => {
    try {
      console.log(`🔍 Loading ${tab} images for project: ${project.name}`, { stage, room });
      
      let searchTags = [];
      
      if (project.type === 'complete') {
        // Complete projects use their predefined tags
        searchTags = [...project.tags]; // Use spread to avoid mutations
      } else {
        // Current projects search by project name
        searchTags = [project.name.toLowerCase()];
      }
      
      console.log(`📊 Initial search tags for ${project.name}:`, searchTags);
      
      // Add tab-specific filtering - MUST have BOTH project tag AND type tag
      if (tab === 'precedent') {
        searchTags.push('precedent');
        console.log(`🏷️ Added 'precedent' tag - now searching for ALL of: [${searchTags.join(', ')}]`);
      } else if (tab === 'texture') {
        searchTags.push('texture');
        console.log(`🏷️ Added 'texture' tag - now searching for ALL of: [${searchTags.join(', ')}]`);  
      } else if (tab === 'photos') {
        if (project.type === 'complete') {
          // Photos tab for complete projects - already includes complete tag
          console.log(`📸 Photos tab for complete project - using tags: [${searchTags.join(', ')}]`);
        } else {
          // For current projects, photos might not have specific tags yet
          console.log(`📸 Photos tab for current project - using tags: [${searchTags.join(', ')}]`);
        }
      }

      // Add stage and room filters if specified
      if (stage) {
        searchTags.push(stage);
        console.log(`🏗️ Added stage filter '${stage}' - now: [${searchTags.join(', ')}]`);
      }
      if (room) {
        searchTags.push(room);
        console.log(`🏠 Added room filter '${room}' - now: [${searchTags.join(', ')}]`);
      }
      
      console.log(`🔎 FINAL SEARCH: Looking for images with ALL tags: [${searchTags.join(', ')}]`);
      
      const response = await apiCall('/api/images/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: searchTags
        })
      });
      
      if (response.ok) {
        const images = await response.json();
        console.log(`✅ Found ${images?.length || 0} ${tab} images for ${project.name}`);
        
        // Store images with project, tab, stage, and room key
        const key = `${project.id}-${tab}-${stage}-${room}`;
        setProjectImages(prev => ({
          ...prev,
          [key]: images || []
        }));
        
        return images || [];
      } else {
        console.warn(`Failed to load ${tab} images for ${project.name}`);
        return [];
      }
    } catch (error) {
      console.error(`Error loading ${tab} images for ${project.name}:`, error);
      return [];
    }
  };

  const createNewProject = async () => {
    if (!newProjectName.trim()) return;
    
    const newProject = {
      id: newProjectName.toLowerCase().replace(/\s+/g, '-'),
      name: newProjectName.trim(),
      tags: [newProjectName.toLowerCase()],
      type: 'current',
      created: new Date().toISOString()
    };
    
    const updatedCurrentProjects = [...currentProjects, newProject];
    setCurrentProjects(updatedCurrentProjects);
    
    // Save to localStorage
    localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedCurrentProjects));
    
    setNewProjectName('');
    setShowNewProjectForm(false);
    
    console.log(`✅ Created new project: ${newProject.name}`);
  };

  // ProjectThumbnail component for gallery-style project cards
  const ProjectThumbnail = ({ project }) => {
    const [thumbnailImage, setThumbnailImage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadThumbnail();
    }, [project]);

    const loadThumbnail = async () => {
      try {
        setLoading(true);
        let searchTags = [];
        
        if (project.type === 'complete') {
          searchTags = project.tags;
        } else {
          searchTags = [project.name.toLowerCase()];
        }
        
        const response = await apiCall('/api/images/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: searchTags })
        });
        
        if (response.ok) {
          const images = await response.json();
          if (images.length > 0) {
            setThumbnailImage(images[0]);
          }
        }
      } catch (error) {
        console.error(`Error loading thumbnail for ${project.name}:`, error);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div
        onClick={() => {
          const url = project.type === 'complete' 
            ? `/projects/complete/${project.id}` 
            : `/projects/current/${project.id}`;
          console.log(`🔗 NAVIGATE: Going to ${url}`);
          navigate(url);
        }}
        className="relative group cursor-pointer"
      >
        <div className="bg-white overflow-hidden shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 aspect-square w-48 h-48">
          <div className="relative w-full h-full overflow-hidden">
            {loading ? (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : thumbnailImage ? (
              <img
                src={thumbnailImage.url || '/api/placeholder-image.jpg'}
                alt={project.name}
                loading="lazy"
                className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  e.target.src = '/api/placeholder-image.jpg';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 font-medium">{project.name}</p>
                </div>
              </div>
            )}
            
            {/* Hover Overlay - Match Gallery Style */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
              <div className="p-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color: '#C9D468'}}>
                  {project.type === 'complete' ? 'Complete' : 'Current'}
                </div>
                <div className="text-sm font-medium text-white/90">
                  {project.name}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Complete Projects Section */}
      <div>
        <div className="flex items-center justify-center mb-6">
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:text-green-700 transition-colors"
            onClick={() => navigate('/projects/complete')}
          >
            <h2 className="text-xl font-semibold text-gray-900">Complete</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {completeProjects.map(project => (
            <ProjectThumbnail key={project.id} project={project} />
          ))}
        </div>
      </div>

      {/* Current Projects Section */}
      <div>
        <div className="flex items-center justify-center mb-6 relative">
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:text-blue-700 transition-colors"
            onClick={() => navigate('/projects/current')}
          >
            <h2 className="text-xl font-semibold text-gray-900">Current</h2>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowNewProjectForm(true)}
              className="absolute right-0 flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors text-sm"
              style={{backgroundColor: '#6b7249', borderColor: '#84823a'}}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#84823a'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7249'}
            >
              <Plus className="h-4 w-4" />
              <span>New Project</span>
            </button>
          )}
        </div>
        
        {/* New Project Form */}
        {showNewProjectForm && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Project name (e.g., Couvreur)"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createNewProject();
                  if (e.key === 'Escape') setShowNewProjectForm(false);
                }}
                autoFocus
              />
              <button
                onClick={createNewProject}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewProjectForm(false);
                  setNewProjectName('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentProjects.map(project => (
            <ProjectThumbnail key={project.id} project={project} />
          ))}
          
          {currentProjects.length === 0 && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No current projects yet</p>
              {canEdit && (
                <p className="text-gray-400 text-sm mt-2">Create your first project above</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderProjectView = () => {
    if (!activeProject) return null;
    
    // Force reload of images when switching tabs to prevent cache issues
    const cacheKey = `${activeProject.id}-${activeProjectTab}-${stageFilter}-${roomFilter}`;
    const currentImages = projectImages[cacheKey] || [];
    
    console.log(`🖼️ DISPLAY: Showing images for ${cacheKey}`);
    console.log(`🖼️ DISPLAY: Found ${currentImages.length} images in cache`);
    console.log(`🖼️ DISPLAY: Available cache keys:`, Object.keys(projectImages));
    console.log(`🖼️ DISPLAY: Current tab state - activeProjectTab: ${activeProjectTab}, stageFilter: ${stageFilter}, roomFilter: ${roomFilter}`);
    
    return (
      <div>
        {/* Project Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => setViewMode('overview')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Projects</span>
            </button>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{activeProject.name}</h1>
          </div>
        </div>

        {/* Project Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {['precedent', 'texture', 'photos'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  console.log(`🔄 TAB SWITCH: From ${activeProjectTab} to ${tab}`);
                  
                  // CRITICAL: Clear everything BEFORE setting new tab state
                  setProjectImages(prev => {
                    const updated = { ...prev };
                    // Clear all keys for this project to prevent any cache contamination
                    Object.keys(updated).forEach(key => {
                      if (key.startsWith(`${activeProject.id}-`)) {
                        delete updated[key];
                        console.log(`🗑️ CACHE: Deleted cache key ${key}`);
                      }
                    });
                    return updated;
                  });
                  
                  // Force immediate re-render with new state
                  setForceRefresh(prev => prev + 1);
                  
                  // Set all new states atomically
                  setActiveProjectTab(tab);
                  setStageFilter('');
                  setRoomFilter('');
                  
                  // Load fresh data for new tab
                  setTimeout(() => {
                    loadProjectImages(activeProject, tab, '', '');
                  }, 0);
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap capitalize ${
                  activeProjectTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Stage and Room Filters (for precedent and texture tabs) */}
        {(activeProjectTab === 'precedent' || activeProjectTab === 'texture') && (
          <div className="mb-6 flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Stage:</label>
              <select
                value={stageFilter}
                onChange={(e) => {
                  setStageFilter(e.target.value);
                  loadProjectImages(activeProject, activeProjectTab, e.target.value, roomFilter);
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 w-36"
              >
                <option value="">All Stages</option>
                <option value="feasibility">Feasibility</option>
                <option value="layout">Layout</option>
                <option value="finishes">Finishes</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Room:</label>
              <select
                value={roomFilter}
                onChange={(e) => {
                  setRoomFilter(e.target.value);
                  loadProjectImages(activeProject, activeProjectTab, stageFilter, e.target.value);
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 w-36"
              >
                <option value="">All Rooms</option>
                <option value="living">Living</option>
                <option value="dining">Dining</option>
                <option value="kitchen">Kitchen</option>
                <option value="bathroom">Bathroom</option>
                <option value="bedroom">Bedroom</option>
              </select>
            </div>

            {(stageFilter || roomFilter) && (
              <button
                onClick={() => {
                  setStageFilter('');
                  setRoomFilter('');
                  loadProjectImages(activeProject, activeProjectTab, '', '');
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Project Images - Force re-render with key */}
        <div key={`${activeProject.id}-${activeProjectTab}-${stageFilter}-${roomFilter}-${forceRefresh}`}>
          {console.log(`🔍 RENDER CHECK: currentImages.length = ${currentImages.length}, showing images:`, currentImages.slice(0, 2))}
          {currentImages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {currentImages.map((image, index) => {
              // Helper functions for image metadata display
              const getImageType = () => {
                const tags = image.tags || [];
                if (tags.some(tag => tag.toLowerCase() === 'precedent')) return 'Precedent';
                if (tags.some(tag => tag.toLowerCase() === 'texture')) return 'Texture';
                if (tags.some(tag => tag.toLowerCase() === 'photos')) return 'Photos';
                return 'General';
              };

              const getImageCategory = () => {
                const tags = image.tags || [];
                const categoryTags = ['brick', 'carpet', 'concrete', 'fabric', 'metal', 'stone', 'tile', 'wood', 'general', 'art', 'bathrooms', 'details', 'doors', 'exteriors', 'furniture', 'interiors', 'joinery', 'kitchens', 'landscape', 'lighting', 'spatial', 'stairs', 'structure'];
                const foundCategory = tags.find(tag => categoryTags.includes(tag.toLowerCase()));
                return foundCategory ? foundCategory.charAt(0).toUpperCase() + foundCategory.slice(1).toLowerCase() : 'General';
              };

              const getAllTags = () => {
                return image.tags || [];
              };

              return (
                <div 
                  key={`${image.id}-${activeProjectTab}-${index}-${forceRefresh}`} 
                  className="relative group cursor-pointer"
                  onClick={() => navigate(`/image/${image.id}`, { state: { from: 'projects' } })}
                >
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
                      
                      {/* Hover Overlay with Properties */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                        <div className="p-4 text-white">
                          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color: '#C9D468'}}>
                            {getImageType()}
                          </div>
                          <div className="text-sm font-medium text-white/90 mb-2">
                            Category: {getImageCategory()}
                          </div>
                          {getAllTags().length > 0 && (
                            <div className="text-xs text-white/80">
                              Tags: {getAllTags().join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          ) : (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No {activeProjectTab} images</h3>
              <p className="text-gray-500">
                No images found for {activeProject.name} {activeProjectTab}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading projects...</p>
          </div>
        </div>
      ) : (
        <div>
          {viewMode === 'overview' && renderOverview()}
          {viewMode === 'project' && renderProjectView()}
        </div>
      )}
    </div>
  );
};

export default Projects;
