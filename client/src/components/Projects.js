import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Image as ImageIcon, Clock, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiCall } from '../utils/apiConfig';
import { useMode } from '../context/ModeContext';

// Utility function to capitalize text for display
const capitalizeForDisplay = (text) => {
  if (!text) return text;
  // Capitalize all words in multi-word tags/text
  return text.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

const Projects = () => {
  const { canEdit } = useMode();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'complete', 'current', 'project'
  const [activeProject, setActiveProject] = useState(null);
  const [activeProjectTab, setActiveProjectTab] = useState('precedent'); // 'precedent', 'texture', 'final', 'wip'
  const [error, setError] = useState(null);
  const [projectImages, setProjectImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [completeProjects, setCompleteProjects] = useState([]);
  const [currentProjects, setCurrentProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState('all'); // 'all', 'current', 'complete'
  const [photosFilter, setPhotosFilter] = useState('all'); // 'all', 'final', 'wip' for Photos tab
  const [stageFilter, setStageFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [isInitializing] = useState(false);
  
  // Dynamic stages and rooms data
  const [stages, setStages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Helper function to get valid tabs for a project type
  const getValidTabs = (project) => {
    if (!project) return [];
    // All projects have the same 3 tabs: Precedent, Texture, Photos
    // Photos shows images tagged with "complete" + project name + optional final/wip
    return ['precedent', 'texture', 'photos'];
  };

  // Helper function to get default tab for a project type
  const getDefaultTab = (project) => {
    if (!project) return 'precedent';
    return 'precedent'; // All projects start with precedent tab
  };

  // Helper function to validate and fix tab state
  const validateAndFixTab = (project, currentTab) => {
    if (!project) return 'precedent';
    const validTabs = getValidTabs(project);
    return validTabs.includes(currentTab) ? currentTab : getDefaultTab(project);
  };

  // Default projects that auto-generate from tags
  const defaultCompleteProjects = [
    { 
      id: 'yandoit', 
      name: 'Yandoit',
      tags: ['archier', 'yandoit', 'complete'],
      type: 'complete'
    }
  ];

  const handleUrlRouting = () => {
    const path = location.pathname;
    const projectId = params.projectId;
    const tabId = params.tabId;
    
    console.log(`🌐 URL ROUTING: path=${path}, projectId=${projectId}, tabId=${tabId}`);
    
    // Guard clause: Only proceed if projects are loaded
    if (!completeProjects.length && !currentProjects.length && !loading) {
      console.log(`🌐 Projects not loaded yet, skipping routing`);
      return;
    }
    
    if (path === '/projects/complete') {
      console.log(`🌐 Setting view to complete`);
      setViewMode('complete');
    } else if (path.startsWith('/projects/complete/') && projectId) {
      console.log(`🌐 Loading complete project: ${projectId}, tab: ${tabId}`);
      const project = completeProjects.find(p => p.id === projectId) || defaultCompleteProjects.find(p => p.id === projectId);
      if (project) {
        console.log(`🌐 Found project:`, project);
        setActiveProject(project);
        setViewMode('project');
        
        // URL-based tab routing with fallback
        const validTabs = getValidTabs(project);
        const selectedTab = tabId && validTabs.includes(tabId) ? tabId : getDefaultTab(project);
        
        // If URL doesn't have tab or has invalid tab, redirect to include correct tab
        if (!tabId || !validTabs.includes(tabId)) {
          console.log(`🌐 Redirecting to /projects/complete/${projectId}/${selectedTab}`);
          navigate(`/projects/complete/${projectId}/${selectedTab}`, { replace: true });
          return;
        }
        
        setActiveProjectTab(selectedTab);
        loadProjectImages(project, selectedTab);
      }
    } else if (path === '/projects/current') {
      console.log(`🌐 Setting view to current`);
      setViewMode('current');
    } else if (path.startsWith('/projects/current/') && projectId) {
      console.log(`🌐 Loading current project: ${projectId}, tab: ${tabId}`);
      console.log(`🌐 Available current projects:`, currentProjects.map(p => p.id));
      const project = currentProjects.find(p => p.id === projectId);
      if (project) {
        console.log(`🌐 Found project:`, project);
        
        // CRITICAL FIX: Update project name if it's the old "De Witt" name
        if (project.id === 'de-witt' && project.name !== 'De Witt St') {
          console.log(`🔧 Updating project name from "${project.name}" to "De Witt St"`);
          project.name = 'De Witt St';
          
          // Update in currentProjects array
          const updatedProjects = currentProjects.map(p => 
            p.id === 'de-witt' ? { ...p, name: 'De Witt St' } : p
          );
          setCurrentProjects(updatedProjects);
        }
        
        setActiveProject(project);
        setViewMode('project');
        
        // URL-based tab routing with fallback
        const validTabs = getValidTabs(project);
        const selectedTab = tabId && validTabs.includes(tabId) ? tabId : getDefaultTab(project);
        
        // If URL doesn't have tab or has invalid tab, redirect to include correct tab
        if (!tabId || !validTabs.includes(tabId)) {
          console.log(`🌐 Redirecting to /projects/current/${projectId}/${selectedTab}`);
          navigate(`/projects/current/${projectId}/${selectedTab}`, { replace: true });
          return;
        }
        
        setActiveProjectTab(selectedTab);
        loadProjectImages(project, selectedTab);
      } else {
        console.log(`🌐 Project ${projectId} not found in current projects`);
        
        // If project not found, redirect to overview
        navigate('/projects');
      }
    } else {
      console.log(`🌐 Setting view to overview`);
      setViewMode('overview');
    }
  };

  useEffect(() => {
    loadProjects();
    loadStagesAndRooms();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStagesAndRooms = async () => {
    try {
      // Load stages and rooms in parallel
      const [stagesResponse, roomsResponse] = await Promise.all([
        apiCall('/api/stages'),
        apiCall('/api/rooms')
      ]);

      if (stagesResponse.ok) {
        const stagesData = await stagesResponse.json();
        setStages(stagesData);
      } else {
        console.error('Failed to load stages');
      }

      if (roomsResponse.ok) {
        const roomsData = await roomsResponse.json();
        setRooms(roomsData);
      } else {
        console.error('Failed to load rooms');
      }
    } catch (error) {
      console.error('Error loading stages and rooms:', error);
    } finally {
      setStagesLoading(false);
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    // Only handle URL routing after projects are loaded and not during initialization
    if (!loading && !isInitializing) {
      handleUrlRouting();
    }
  }, [location.pathname, params.projectId, params.tabId, loading, isInitializing, completeProjects, currentProjects]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProjects = async () => {
    try {
      setLoading(true);
      
      // Load complete projects from database API
      try {
        console.log('🔄 Loading projects from API...');
        const response = await fetch('/api/projects');
        if (response.ok) {
          const projects = await response.json();
          console.log(`✅ Loaded ${projects.length} projects from API:`, projects);
          
          // Filter projects by type and add type field for compatibility
          const complete = projects.filter(p => p.status === 'complete').map(p => ({...p, type: 'complete'}));
          const current = projects.filter(p => p.status === 'current' || !p.status).map(p => ({...p, type: 'current'}));
          
          setCompleteProjects(complete);
          console.log(`📊 Complete projects: ${complete.length}`);
          
          // Also load current projects from API
          setCurrentProjects(current);
          console.log(`📊 Current projects: ${current.length}`);
        } else {
          console.error('❌ Failed to load projects from API, using fallback');
          // Fallback to hardcoded list
          setCompleteProjects(defaultCompleteProjects);
          setCurrentProjects([]);
        }
      } catch (error) {
        console.error('❌ Error loading projects from API:', error);
        // Fallback to hardcoded only
        setCompleteProjects(defaultCompleteProjects);
        setCurrentProjects([]);
      }
      
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectImages = async (project, tab = 'photos', stage = '', room = '') => {
    // FAILSAFE: Validate inputs
    if (!project || !project.id || !project.name) {
      console.error('❌ Invalid project data:', project);
      setError('Invalid project data');
      return [];
    }

    // FAILSAFE: Validate and fix tab
    const validTab = validateAndFixTab(project, tab);
    if (validTab !== tab) {
      console.warn(`⚠️ Invalid tab "${tab}" for project type "${project.type}", using "${validTab}"`);
      tab = validTab;
    }

    const cacheKey = `${project.id}-${tab}-${stage}-${room}-${photosFilter}`;
    
    // Check if we already have cached results
    if (projectImages[cacheKey] && Array.isArray(projectImages[cacheKey])) {
      console.log(`💨 CACHE HIT: Using cached images for ${cacheKey}`);
      return;
    }
    
    // Set loading state immediately
    setProjectImages(prev => ({ ...prev, [cacheKey]: null }));
    setError(null);
    
    try {
      console.log(`🔍 Loading ${tab} images for project: ${project.name}`, { stage, room });
      
      let searchTags = [];
      
      if (project.type === 'complete') {
        // Complete projects use their predefined tags + Final/WIP
        searchTags = [...project.tags]; // Use spread to avoid mutations
        
        if (tab === 'final') {
          searchTags.push('final', 'complete'); // Images in Final folder
          console.log(`📊 Complete project FINAL tags: [${searchTags.join(', ')}]`);
        } else if (tab === 'wip') {
          searchTags.push('wip'); // Images in WIP folder (remove complete tag)
          searchTags = searchTags.filter(tag => tag !== 'complete'); 
          console.log(`📊 Complete project WIP tags: [${searchTags.join(', ')}]`);
        } else {
          // Legacy support for photos tab
          console.log(`📊 Complete project ALL tags: [${searchTags.join(', ')}]`);
        }
      } else {
        // Current projects - we'll use text search instead of tag search
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
        // Photos tab - add Final/WIP filter if selected
        if (photosFilter === 'final') {
          searchTags.push('final');
        } else if (photosFilter === 'wip') {
          searchTags.push('wip');
        }
        console.log(`📸 Photos tab with filter '${photosFilter}' - using tags: [${searchTags.join(', ')}]`);
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
      
      // CRITICAL FIX: Use a more precise search approach
      console.log(`🔍 DEBUG: Searching for images with tags: [${searchTags.join(', ')}]`);
      
      // NEW: Use project assignment search for project-specific queries
      let searchBody;
      
      if (project.type === 'current' && (tab === 'precedent' || tab === 'texture')) {
        // For current projects precedent/texture tabs: use project assignment search
        console.log(`🔍 Using PROJECT ASSIGNMENT search for ${project.name} ${tab}`);
        
        searchBody = {
          tags: [tab], // Must have the type tag (precedent or texture)
          projectAssignment: {
            projectId: project.id,
            ...(room && { room }),
            ...(stage && { stage })
          }
        };
        
        console.log(`🔍 PROJECT ASSIGNMENT SEARCH:`, searchBody);
        console.log(`🔍 DETAILED REQUEST:`, JSON.stringify(searchBody, null, 2));
      } else if (project.type === 'current' && tab === 'photos') {
        // Photos tab - still use traditional tag search for current projects
        const requiredTags = [];
        
        if (project.id === 'de-witt') {
          requiredTags.push('de witt st');
        } else {
          requiredTags.push(project.name.toLowerCase());
        }
        
        // Photos tab must be tagged "complete"
        requiredTags.push('complete');
        
        // Add Final/WIP filter if selected
        if (photosFilter === 'final') {
          requiredTags.push('final');
        } else if (photosFilter === 'wip') {
          requiredTags.push('wip');
        }
        
        searchBody = { tags: requiredTags };
        console.log(`🔍 PHOTOS SEARCH (current project): ALL required tags: [${requiredTags.join(', ')}]`);
      } else {
        // Complete projects and fallback cases use exact tag matching
        searchBody = { tags: searchTags };
        console.log(`🔍 TAG SEARCH: exact tags: [${searchTags.join(', ')}]`);
      }
      
      console.log(`🌐 MAKING API CALL to /api/images/search with:`, JSON.stringify(searchBody, null, 2));
      const response = await apiCall('/api/images/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchBody)
      });
      console.log(`🌐 API RESPONSE STATUS:`, response.status);
      console.log(`🌐 API RESPONSE OK:`, response.ok);
      
      if (response.ok) {
        const images = await response.json();
        console.log(`✅ Found ${images?.length || 0} ${tab} images for ${project.name}`);
        
        // Debug: Log first few images to verify they match the search
        if (images.length > 0) {
          console.log(`🔍 RESULT VERIFICATION: First 3 images:`, images.slice(0, 3).map(img => ({
            id: img.id,
            filename: img.filename,
            tags: img.tags
          })));
          
          // Check if any images are incorrectly included
          images.slice(0, 5).forEach((img, idx) => {
            const hasProjectTag = img.tags?.some(tag => 
              tag.toLowerCase() === 'de witt st' || 
              tag.toLowerCase().includes('de witt') || 
              tag.toLowerCase().includes('dewitt') || 
              tag.toLowerCase() === 'de-witt'
            );
            const hasTypeTag = img.tags?.some(tag => 
              ['precedent', 'texture'].includes(tag.toLowerCase())
            );
            console.log(`🔍 IMG ${idx + 1}: ${img.filename} | Project tag: ${hasProjectTag} | Type tags: ${hasTypeTag} | All tags: [${img.tags?.join(', ') || 'none'}]`);
          });
        }
        
        // Store images with project, tab, stage, room, and photos filter key
        const key = `${project.id}-${tab}-${stage}-${room}-${photosFilter}`;
        
        // Clear any old cache entries for this project before setting new ones
        setProjectImages(prev => {
          const updated = { ...prev };
          
          // Remove any existing cache for this exact key
          if (updated[key]) {
            console.log(`🗑️ CACHE: Clearing existing cache for ${key}`);
            delete updated[key];
          }
          
          // Set new cache
          updated[key] = images || [];
          console.log(`💾 CACHE: Saved ${images.length} images to cache key: ${key}`);
          
          return updated;
        });
        
        return images || [];
      } else {
        console.warn(`⚠️ API request failed for ${project.name} ${tab}: ${response.status}`);
        const errorMessage = `Failed to load ${tab} images (${response.status})`;
        setError(errorMessage);
        
        // Store empty array in cache to prevent retry loops
        const key = `${project.id}-${tab}-${stage}-${room}`;
        setProjectImages(prev => ({ ...prev, [key]: [] }));
        return [];
      }
    } catch (error) {
      console.error(`❌ Error loading ${tab} images for ${project.name}:`, error);
      const errorMessage = `Failed to load ${tab} images: ${error.message}`;
      setError(errorMessage);
      
      // Store empty array in cache to prevent retry loops
      const key = `${project.id}-${tab}-${stage}-${room}`;
      setProjectImages(prev => ({ ...prev, [key]: [] }));
      
      return [];
    } finally {
    }
  };


  // ProjectThumbnail component for gallery-style project cards
  const ProjectThumbnail = ({ project, delay = 0 }) => {
    const [thumbnailImage, setThumbnailImage] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadThumbnail = useCallback(async () => {
      try {
        setLoading(true);
        
        // Add delay to prevent API stampede
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // For current projects, skip API call and use solid color
        if (project.type === 'current') {
          setLoading(false);
          return;
        }
        
        // For complete projects, just search for ANY image with the project tags
        if (project.type === 'complete') {
          try {
            // Simple search for images with archier + complete + project name tags
            const searchResponse = await apiCall('/api/images/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tags: ['archier', 'complete', project.name.toLowerCase()],
                sortBy: 'upload_date',
                sortOrder: 'desc'
              })
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.images && searchData.images.length > 0) {
                // Just use the first image from this project
                const firstImage = searchData.images[0];
                setThumbnailImage({
                  id: firstImage.id,
                  filename: firstImage.filename,
                  url: firstImage.url || `/api/images/${firstImage.id}/url`
                });
              } else {
                setThumbnailImage(null);
              }
            } else {
              setThumbnailImage(null);
            }
          } catch (searchError) {
            console.warn(`No images found for project: ${project.name}`);
            setThumbnailImage(null);
          }
        }
      } catch (error) {
        console.error(`Error loading thumbnail for ${project.name}:`, error);
        setThumbnailImage(null);
      } finally {
        setLoading(false);
      }
    }, [project.type, project.name, delay]);

    useEffect(() => {
      loadThumbnail();
    }, [loadThumbnail]); // Depend on memoized function

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
            ) : project.type === 'current' ? (
              <div className="w-full h-full flex items-center justify-center" style={{backgroundColor: '#BDAE93'}}>
                <div className="text-center">
                  <FolderOpen className="h-12 w-12 text-black mx-auto mb-2" />
                  <p className="text-black font-medium">{project.name}</p>
                  <p className="text-black/60 text-xs mt-1">CURRENT</p>
                </div>
              </div>
            ) : thumbnailImage ? (
              <img
                src={thumbnailImage.url || '/api/placeholder-image.jpg'}
                alt={project.name}
                loading="lazy"
                className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        console.log(`❌ Image failed to load for ${project.name}:`, thumbnailImage.url);
                        // Fall back to placeholder
                        e.target.src = '/api/placeholder-image.jpg';
                      }}
                onLoad={() => {
                  console.log(`✅ Image loaded for ${project.name}`);
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

  const getFilteredProjects = () => {
    const allProjects = [...completeProjects, ...currentProjects];
    
    switch (projectFilter) {
      case 'current':
        return currentProjects;
      case 'complete':
        return completeProjects;
      default:
        return allProjects;
    }
  };

  const renderOverview = () => (
    <div>
      {/* Filter Dropdown - Left aligned */}
      <div className="flex justify-start mb-6">
        <div className="relative">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
          >
            <option value="all">All Projects</option>
            <option value="current">Current Projects</option>
            <option value="complete">Complete Projects</option>
          </select>
        </div>
      </div>

      {/* Single Project Grid - 6 projects per row on full browser */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {getFilteredProjects().map((project, index) => (
          <ProjectThumbnail 
            key={project.id} 
            project={project} 
            delay={index * 200} // Stagger loads by 200ms each
          />
        ))}
        
        {getFilteredProjects().length === 0 && (
          <div className="col-span-full text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {projectFilter === 'current' ? 'No current projects yet' : 
               projectFilter === 'complete' ? 'No complete projects yet' : 
               'No projects yet'}
            </p>
            {canEdit && projectFilter !== 'complete' && (
              <p className="text-sm text-gray-400 mt-2">Projects will appear here when created</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderProjectView = () => {
    if (!activeProject) return null;
    
    // Force reload of images when switching tabs to prevent cache issues
    const cacheKey = `${activeProject.id}-${activeProjectTab}-${stageFilter}-${roomFilter}-${photosFilter}`;
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
            {getValidTabs(activeProject).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  console.log(`🔄 TAB SWITCH: From ${activeProjectTab} to ${tab}`);
                  
                  // Navigate to new URL with tab
                  const projectType = activeProject.type === 'complete' ? 'complete' : 'current';
                  const newUrl = `/projects/${projectType}/${activeProject.id}/${tab}`;
                  console.log(`🌐 Navigating to: ${newUrl}`);
                  navigate(newUrl);
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

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage and Room Filters (for precedent and texture tabs only) */}
        {activeProject.type === 'current' && (activeProjectTab === 'precedent' || activeProjectTab === 'texture') && (
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
                {stagesLoading ? (
                  <option disabled>Loading...</option>
                ) : (
                  stages.map(stage => (
                    <option key={stage.id} value={stage.name}>
                      {stage.name.charAt(0).toUpperCase() + stage.name.slice(1)}
                    </option>
                  ))
                )}
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
                {roomsLoading ? (
                  <option disabled>Loading...</option>
                ) : (
                  rooms.map(room => (
                    <option key={room.id} value={room.name}>
                      {room.name.charAt(0).toUpperCase() + room.name.slice(1)}
                    </option>
                  ))
                )}
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

        {/* Final/WIP Filter - Only for Photos tab */}
        {activeProjectTab === 'photos' && (
          <div className="mb-6 flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={photosFilter}
                onChange={(e) => {
                  setPhotosFilter(e.target.value);
                  loadProjectImages(activeProject, activeProjectTab, stageFilter, roomFilter);
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 w-32"
              >
                <option value="all">All</option>
                <option value="final">Final</option>
                <option value="wip">WIP</option>
              </select>
            </div>

            {photosFilter !== 'all' && (
              <button
                onClick={() => {
                  setPhotosFilter('all');
                  loadProjectImages(activeProject, activeProjectTab, stageFilter, roomFilter);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Filter
              </button>
            )}
          </div>
        )}

        {/* Project Images - Force re-render with key */}
        <div key={`${activeProject.id}-${activeProjectTab}-${stageFilter}-${roomFilter}-${photosFilter}`}>
          {console.log(`🔍 RENDER CHECK: currentImages.length = ${currentImages.length}, showing images:`, currentImages.slice(0, 2))}
          {/* Loading State - Show while waiting for API response */}
          {projectImages[cacheKey] === null ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading {activeProjectTab} images...</h3>
              <p className="text-gray-500">
                Searching for {activeProject.name} {activeProjectTab}
              </p>
            </div>
          ) : currentImages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-center">
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
                const result = foundCategory ? foundCategory.charAt(0).toUpperCase() + foundCategory.slice(1).toLowerCase() : 'General';
                
                // Debug log for category detection
                console.log(`🏷️ CATEGORY DEBUG for ${image.filename}: tags=[${tags.join(', ')}], found=${foundCategory}, result=${result}`);
                
                return result;
              };

              const getAllTags = () => {
                return image.tags || [];
              };

              return (
                <div 
                  key={`${image.id}-${activeProjectTab}-${index}`} 
                  className="relative group cursor-pointer transition-all duration-200 w-full max-w-full"
                  onClick={() => navigate(`/image/${image.id}`, { state: { from: 'projects' } })}
                >
                  <div className="relative aspect-square bg-gray-100 overflow-hidden w-full max-w-full">
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
                            Tags: {getAllTags().map(tag => capitalizeForDisplay(tag)).join(', ')}
                          </div>
                        )}
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
