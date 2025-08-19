import React, { useState, useEffect } from 'react';
import { FolderOpen, Image as ImageIcon, Plus, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/apiConfig';
import { useMode } from '../context/ModeContext';

const Projects = () => {
  const { canEdit } = useMode();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'complete', 'current', 'project'
  const [activeProject, setActiveProject] = useState(null);
  const [activeProjectTab, setActiveProjectTab] = useState('photos'); // 'precedent', 'texture', 'photos'
  const [projectImages, setProjectImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [completeProjects, setCompleteProjects] = useState([]);
  const [currentProjects, setCurrentProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);

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

  const loadProjectImages = async (project, tab = 'photos') => {
    try {
      console.log(`🔍 Loading ${tab} images for project: ${project.name}`);
      
      let searchTags = [];
      
      if (project.type === 'complete') {
        // Complete projects use their predefined tags
        searchTags = project.tags;
      } else {
        // Current projects search by project name
        searchTags = [project.name.toLowerCase()];
      }
      
      // Add tab-specific filtering
      if (tab === 'precedent') {
        searchTags.push('precedent');
      } else if (tab === 'texture') {
        searchTags.push('texture');
      } else if (tab === 'photos' && project.type === 'complete') {
        // Photos tab for complete projects shows images with project tags + complete
        // Already included in project.tags
      }
      
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
        
        // Store images with project and tab key
        const key = `${project.id}-${tab}`;
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

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Complete Projects Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Complete Projects</h2>
          </div>
          <button
            onClick={() => setViewMode('complete')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View All →
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {completeProjects.map(project => (
            <div
              key={project.id}
              onClick={() => {
                setActiveProject(project);
                setViewMode('project');
                loadProjectImages(project, 'photos');
              }}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-medium text-gray-900">{project.name}</h3>
                <p className="text-sm text-gray-500 mt-1">Complete</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Projects Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Clock className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Current Projects</h2>
          </div>
          <div className="flex items-center space-x-3">
            {canEdit && (
              <button
                onClick={() => setShowNewProjectForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>New Project</span>
              </button>
            )}
            <button
              onClick={() => setViewMode('current')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All →
            </button>
          </div>
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
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {currentProjects.map(project => (
            <div
              key={project.id}
              onClick={() => {
                setActiveProject(project);
                setViewMode('project');
                loadProjectImages(project, 'precedent');
              }}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-medium text-gray-900">{project.name}</h3>
                <p className="text-sm text-gray-500 mt-1">In Progress</p>
              </div>
            </div>
          ))}
          
          {currentProjects.length === 0 && (
            <div className="col-span-full text-center py-8">
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
    
    const currentImages = projectImages[`${activeProject.id}-${activeProjectTab}`] || [];
    
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
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              activeProject.type === 'complete' ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {activeProject.type === 'complete' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Clock className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{activeProject.name}</h1>
              <p className="text-gray-600">
                {activeProject.type === 'complete' ? 'Complete Project' : 'Current Project'}
              </p>
            </div>
          </div>
        </div>

        {/* Project Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {['precedent', 'texture', 'photos'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveProjectTab(tab);
                  loadProjectImages(activeProject, tab);
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap capitalize ${
                  activeProjectTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
                {projectImages[`${activeProject.id}-${tab}`] && (
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {projectImages[`${activeProject.id}-${tab}`].length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Project Images */}
        {currentImages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {currentImages.map((image) => (
              <div 
                key={image.id} 
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
                  </div>
                </div>
              </div>
            ))}
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
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-2">
          <FolderOpen className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        </div>
        <p className="text-gray-600">Manage and browse images from architectural projects</p>
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
