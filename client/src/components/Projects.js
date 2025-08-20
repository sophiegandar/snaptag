import React, { useState, useEffect } from 'react';
import { FolderOpen, Image as ImageIcon, Plus, CheckCircle, Clock, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiCall } from '../utils/apiConfig';
import { useMode } from '../context/ModeContext';

const Projects = () => {
  const { canEdit } = useMode();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'complete', 'current', 'project'
  const [activeProject, setActiveProject] = useState(null);
  const [activeProjectTab, setActiveProjectTab] = useState('photos'); // 'precedent', 'texture', 'photos', 'final', 'wip'
  const [error, setError] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [projectImages, setProjectImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [completeProjects, setCompleteProjects] = useState([]);
  const [currentProjects, setCurrentProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [forceRefresh, setForceRefresh] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);

  // Helper function to get valid tabs for a project type
  const getValidTabs = (project) => {
    if (!project) return [];
    return project.type === 'complete' ? ['final', 'wip'] : ['precedent', 'texture', 'photos'];
  };

  // Helper function to get default tab for a project type
  const getDefaultTab = (project) => {
    if (!project) return 'photos';
    return project.type === 'complete' ? 'final' : 'precedent';
  };

  // Helper function to validate and fix tab state
  const validateAndFixTab = (project, currentTab) => {
    if (!project) return 'photos';
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

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    // Only handle URL routing after projects are loaded and not during initialization
    if (!loading && !isInitializing) {
      handleUrlRouting();
    }
  }, [location.pathname, params.projectId, params.tabId, loading, isInitializing]);

  const handleUrlRouting = () => {
    const path = location.pathname;
    const projectId = params.projectId;
    const tabId = params.tabId;
    
    console.log(`🌐 URL ROUTING: path=${path}, projectId=${projectId}, tabId=${tabId}`);
    
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
        
        // Try to create the project if it doesn't exist (for URL sharing)
        if (projectId === 'couvreur') {
          console.log(`🌐 Creating missing Couvreur project`);
          setIsInitializing(true); // Prevent re-render loop
          
          const newProject = {
            id: 'couvreur',
            name: 'Couvreur',
            tags: ['couvreur'],
            type: 'current',
            created: new Date().toISOString()
          };
        } else if (projectId === 'de-witt') {
          console.log(`🌐 Creating missing De Witt St project`);
          setIsInitializing(true); // Prevent re-render loop
          
          const newProject = {
            id: 'de-witt',
            name: 'De Witt St',
            tags: ['de witt st'],
            type: 'current',
            created: new Date().toISOString()
          };
          
          const updatedCurrentProjects = [...currentProjects, newProject];
          setCurrentProjects(updatedCurrentProjects);
          localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedCurrentProjects));
          
          setActiveProject(newProject);
          setViewMode('project');
          
          // Redirect to proper URL with default tab
          const defaultTab = getDefaultTab(newProject);
          navigate(`/projects/current/${projectId}/${defaultTab}`, { replace: true });
          
          // Allow routing again after a brief delay
          setTimeout(() => setIsInitializing(false), 100);
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
      
      // Load current projects from localStorage with error handling
      try {
        const savedCurrentProjects = localStorage.getItem('snaptag-current-projects');
        if (savedCurrentProjects) {
          const parsed = JSON.parse(savedCurrentProjects);
          // Validate the structure
          if (Array.isArray(parsed) && parsed.every(p => p.id && p.name && p.type)) {
            setCurrentProjects(parsed);
            console.log(`✅ Loaded ${parsed.length} current projects from localStorage`);
          } else {
            console.warn('⚠️ Invalid current projects data in localStorage, clearing...');
            localStorage.removeItem('snaptag-current-projects');
          }
        }
      } catch (error) {
        console.error('❌ Error loading current projects from localStorage:', error);
        localStorage.removeItem('snaptag-current-projects');
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

    const cacheKey = `${project.id}-${tab}-${stage}-${room}`;
    
    // Check if we already have cached results
    if (projectImages[cacheKey] && Array.isArray(projectImages[cacheKey])) {
      console.log(`💨 CACHE HIT: Using cached images for ${cacheKey}`);
      return projectImages[cacheKey];
    }
    
    // Set loading state immediately
    setProjectImages(prev => ({ ...prev, [cacheKey]: null }));
    setApiLoading(true);
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
      
      // CRITICAL FIX: Use a more precise search approach
      console.log(`🔍 DEBUG: Searching for images with tags: [${searchTags.join(', ')}]`);
      
      // FIXED: Use exact tag matching for all projects to ensure precise filtering
      let searchBody;
      
      if (project.type === 'current' && tab !== 'photos') {
        // For current projects precedent/texture tabs: require BOTH project tag AND type tag
        const typeTag = tab === 'precedent' ? 'precedent' : tab === 'texture' ? 'texture' : null;
        
        if (typeTag) {
          // Create comprehensive search tags that must ALL be present
          const requiredTags = [];
          
          // Add project name variations - images should have one of these
          if (project.id === 'de-witt') {
            requiredTags.push('de witt st'); // Exact match for "de witt st"
          } else {
            requiredTags.push(project.name.toLowerCase());
          }
          
          // Add type tag (precedent/texture)
          requiredTags.push(typeTag);
          
          // Add stage and room filters if specified
          if (stage) requiredTags.push(stage);
          if (room) requiredTags.push(room);
          
          searchBody = { tags: requiredTags };
          console.log(`🔍 EXACT TAG SEARCH: ALL required tags: [${requiredTags.join(', ')}]`);
        } else {
          // Photos tab for current projects - require BOTH project tag AND "complete" tag
          const requiredTags = [];
          
          if (project.id === 'de-witt') {
            requiredTags.push('de witt st');
          } else {
            requiredTags.push(project.name.toLowerCase());
          }
          
          // Current projects photos must also be tagged "complete"
          requiredTags.push('complete');
          
          searchBody = { tags: requiredTags };
          console.log(`🔍 PHOTOS SEARCH (current project): ALL required tags: [${requiredTags.join(', ')}]`);
        }
      } else {
        // Complete projects use exact tag matching (this works fine)
        searchBody = { tags: searchTags };
        console.log(`🔍 TAG SEARCH: exact tags: [${searchTags.join(', ')}]`);
      }
      
      const response = await apiCall('/api/images/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchBody)
      });
      
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
        
        // Store images with project, tab, stage, and room key
        const key = `${project.id}-${tab}-${stage}-${room}`;
        
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
      setApiLoading(false);
    }
  };

  const createNewProject = async () => {
    if (!newProjectName.trim()) return;
    
    const projectName = newProjectName.trim();
    const projectId = projectName.toLowerCase().replace(/\s+/g, '-');
    
    // Check for duplicates in current projects
    const existsInCurrent = currentProjects.some(
      project => project.id === projectId || project.name.toLowerCase() === projectName.toLowerCase()
    );
    
    // Check for duplicates in complete projects
    const existsInComplete = completeProjects.some(
      project => project.id === projectId || project.name.toLowerCase() === projectName.toLowerCase()
    );
    
    if (existsInCurrent || existsInComplete) {
      toast.error(`Project "${projectName}" already exists`);
      return;
    }
    
    const newProject = {
      id: projectId,
      name: projectName,
      tags: [projectName.toLowerCase()],
      type: 'current',
      created: new Date().toISOString()
    };
    
    const updatedCurrentProjects = [...currentProjects, newProject];
    setCurrentProjects(updatedCurrentProjects);
    
    // Save to localStorage
    localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedCurrentProjects));
    
    setNewProjectName('');
    setShowNewProjectForm(false);
    
    toast.success(`Project "${newProject.name}" created successfully`);
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
        <div className="flex items-center justify-center mb-6">
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:text-blue-700 transition-colors"
            onClick={() => navigate('/projects/current')}
          >
            <h2 className="text-xl font-semibold text-gray-900">Current</h2>
          </div>
        </div>
        
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
        
        {/* Loading State - Show while waiting for API response */}
        {projectImages[cacheKey] === null && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading {activeProjectTab} images...</h3>
            <p className="text-gray-500">
              Searching for {activeProject.name} {activeProjectTab}
            </p>
          </div>
        )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* New Project Button - Centered at top */}
      {canEdit && viewMode === 'overview' && (
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowNewProjectForm(true)}
            className="flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors"
            style={{backgroundColor: '#6b7249', borderColor: '#84823a'}}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#84823a'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7249'}
          >
            <Plus className="h-5 w-5" />
            <span>New Project</span>
          </button>
        </div>
      )}

      {/* New Project Form */}
      {showNewProjectForm && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6 max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Project name (e.g., Couvreur)"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewProject();
                if (e.key === 'Escape') {
                  setShowNewProjectForm(false);
                  setNewProjectName('');
                }
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
