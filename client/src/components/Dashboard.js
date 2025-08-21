import React, { useState, useEffect } from 'react';
import { Database, Tags, Folder, Settings, Eye, Edit3, FileText, Layers, Save, TestTube, Check, AlertCircle, RefreshCw, Droplets, Copy, Search, Plus, Trash2, Calendar, X } from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { toast } from 'react-toastify';

const Dashboard = () => {
  const { canEdit } = useMode();
  const [activeSection, setActiveSection] = useState('tags');

  // Projects state
  const [currentProjects, setCurrentProjects] = useState([]);
  const [completeProjects, setCompleteProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');

  // Categories state
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingType, setEditingType] = useState(null);

  // Projects functions
  const loadCurrentProjects = () => {
    try {
      const stored = localStorage.getItem('snaptag-current-projects');
      if (stored) {
        const projects = JSON.parse(stored);
        setCurrentProjects(Array.isArray(projects) ? projects : []);
      }
    } catch (error) {
      console.error('Error loading current projects:', error);
      setCurrentProjects([]);
    }
  };

  const loadCompleteProjects = () => {
    // Load hardcoded complete projects (matching Projects.js)
    const defaultCompleteProjects = [
      {
        id: 'yandoit',
        name: 'Yandoit',
        tags: ['archier', 'yandoit', 'complete'],
        type: 'complete'
      }
    ];
    setCompleteProjects(defaultCompleteProjects);
  };

  // Categories functions
  const loadCategories = () => {
    try {
      const storedCategories = localStorage.getItem('snaptag-categories');
      const storedTypes = localStorage.getItem('snaptag-types');
      
      if (storedCategories) {
        const parsed = JSON.parse(storedCategories);
        setCategories(Array.isArray(parsed) ? parsed : []);
      } else {
        // Default categories
        const defaultCategories = [
          { id: 'exteriors', name: 'Exteriors', description: 'Building exterior views and facades' },
          { id: 'interiors', name: 'Interiors', description: 'Interior spaces and rooms' },
          { id: 'kitchens', name: 'Kitchens', description: 'Kitchen spaces and design' },
          { id: 'bathrooms', name: 'Bathrooms', description: 'Bathroom spaces and fixtures' },
          { id: 'stairs', name: 'Stairs', description: 'Staircase design and details' },
          { id: 'general', name: 'General', description: 'General or uncategorized images' }
        ];
        setCategories(defaultCategories);
        localStorage.setItem('snaptag-categories', JSON.stringify(defaultCategories));
      }

      if (storedTypes) {
        const parsed = JSON.parse(storedTypes);
        setTypes(Array.isArray(parsed) ? parsed : []);
      } else {
        // Default types
        const defaultTypes = [
          { id: 'precedent', name: 'Precedent', description: 'Reference images for design inspiration' },
          { id: 'texture', name: 'Texture', description: 'Material samples and texture references' },
          { id: 'tile', name: 'Tile', description: 'Tile materials and patterns' },
          { id: 'wood', name: 'Wood', description: 'Wood materials and finishes' },
          { id: 'stone', name: 'Stone', description: 'Stone materials and textures' },
          { id: 'brick', name: 'Brick', description: 'Brick materials and patterns' },
          { id: 'metal', name: 'Metal', description: 'Metal materials and finishes' },
          { id: 'carpet', name: 'Carpet', description: 'Carpet and soft flooring materials' }
        ];
        setTypes(defaultTypes);
        localStorage.setItem('snaptag-types', JSON.stringify(defaultTypes));
      }
    } catch (error) {
      console.error('Error loading categories/types:', error);
      setCategories([]);
      setTypes([]);
    }
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    if (!canEdit) {
      toast.error('Category creation is only available in edit mode');
      return;
    }

    const id = newCategoryName.toLowerCase().replace(/\s+/g, '-');
    const existing = categories.find(c => c.id === id);
    
    if (existing) {
      toast.error('A category with this name already exists');
      return;
    }

    const newCategory = {
      id,
      name: newCategoryName.trim(),
      description: `${newCategoryName.trim()} category`
    };

    const updatedCategories = [...categories, newCategory];
    setCategories(updatedCategories);
    localStorage.setItem('snaptag-categories', JSON.stringify(updatedCategories));
    setNewCategoryName('');
    toast.success(`Category "${newCategory.name}" added successfully`);
  };

  const addType = () => {
    if (!newTypeName.trim()) {
      toast.error('Please enter a type name');
      return;
    }

    if (!canEdit) {
      toast.error('Type creation is only available in edit mode');
      return;
    }

    const id = newTypeName.toLowerCase().replace(/\s+/g, '-');
    const existing = types.find(t => t.id === id);
    
    if (existing) {
      toast.error('A type with this name already exists');
      return;
    }

    const newType = {
      id,
      name: newTypeName.trim(),
      description: `${newTypeName.trim()} type`
    };

    const updatedTypes = [...types, newType];
    setTypes(updatedTypes);
    localStorage.setItem('snaptag-types', JSON.stringify(updatedTypes));
    setNewTypeName('');
    toast.success(`Type "${newType.name}" added successfully`);
  };

  const updateCategory = (categoryId, newName, newDescription) => {
    if (!canEdit) {
      toast.error('Category editing is only available in edit mode');
      return;
    }

    const updatedCategories = categories.map(cat => 
      cat.id === categoryId 
        ? { ...cat, name: newName.trim(), description: newDescription.trim() }
        : cat
    );
    
    setCategories(updatedCategories);
    localStorage.setItem('snaptag-categories', JSON.stringify(updatedCategories));
    setEditingCategory(null);
    toast.success('Category updated successfully');
  };

  const updateType = (typeId, newName, newDescription) => {
    if (!canEdit) {
      toast.error('Type editing is only available in edit mode');
      return;
    }

    const updatedTypes = types.map(type => 
      type.id === typeId 
        ? { ...type, name: newName.trim(), description: newDescription.trim() }
        : type
    );
    
    setTypes(updatedTypes);
    localStorage.setItem('snaptag-types', JSON.stringify(updatedTypes));
    setEditingType(null);
    toast.success('Type updated successfully');
  };

  const deleteCategory = (categoryId) => {
    if (!canEdit) {
      toast.error('Category deletion is only available in edit mode');
      return;
    }

    const updatedCategories = categories.filter(c => c.id !== categoryId);
    setCategories(updatedCategories);
    localStorage.setItem('snaptag-categories', JSON.stringify(updatedCategories));
    
    const deletedCategory = categories.find(c => c.id === categoryId);
    toast.success(`Category "${deletedCategory?.name}" deleted successfully`);
  };

  const deleteType = (typeId) => {
    if (!canEdit) {
      toast.error('Type deletion is only available in edit mode');
      return;
    }

    const updatedTypes = types.filter(t => t.id !== typeId);
    setTypes(updatedTypes);
    localStorage.setItem('snaptag-types', JSON.stringify(updatedTypes));
    
    const deletedType = types.find(t => t.id === typeId);
    toast.success(`Type "${deletedType?.name}" deleted successfully`);
  };

  const createNewProject = () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    if (!canEdit) {
      toast.error('Project creation is only available in edit mode');
      return;
    }

    try {
      const existing = currentProjects.find(p => 
        p.name.toLowerCase() === newProjectName.trim().toLowerCase()
      );
      
      if (existing) {
        toast.error('A project with this name already exists');
        return;
      }

      const newProject = {
        id: newProjectName.toLowerCase().replace(/\s+/g, '-'),
        name: newProjectName.trim(),
        tags: [newProjectName.toLowerCase().replace(/\s+/g, ' ')],
        type: 'current',
        created: new Date().toISOString()
      };

      const updatedProjects = [...currentProjects, newProject];
      setCurrentProjects(updatedProjects);
      localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedProjects));
      
      setNewProjectName('');
      toast.success(`Project "${newProject.name}" created successfully`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
  };

  const deleteProject = (projectId) => {
    if (!canEdit) {
      toast.error('Project deletion is only available in edit mode');
      return;
    }

    try {
      const updatedProjects = currentProjects.filter(p => p.id !== projectId);
      setCurrentProjects(updatedProjects);
      localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedProjects));
      
      const deletedProject = currentProjects.find(p => p.id === projectId);
      toast.success(`Project "${deletedProject?.name}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  // Settings state (moved from Settings.js)
  const [settings, setSettings] = useState({
    dropboxToken: '',
    serverUrl: window.location.origin,
    dropboxFolder: '/ARCHIER Team Folder/Support/Production/SnapTag',
    autoBackup: true,
    imageQuality: 85,
    maxFileSize: 10,
    defaultTags: '',
    autoTagging: false,
    metadataFormat: 'both'
  });

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [stats, setStats] = useState({});

  // Settings functions (moved from Settings.js)
  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      
      // Load settings from localStorage
      const saved = localStorage.getItem('snaptag-settings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }
      
      // Also load current server settings
      try {
        const serverUrl = settings.serverUrl || window.location.origin;
        const response = await fetch(`${serverUrl}/api/settings`);
        if (response.ok) {
          const serverSettings = await response.json();
          setSettings(prev => ({ ...prev, ...serverSettings }));
        }
      } catch (error) {
        console.log('Could not load server settings:', error);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Save to localStorage
      localStorage.setItem('snaptag-settings', JSON.stringify(settings));
      
      // Save to server
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings to server');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus(null);
      
      const response = await fetch('/api/test-dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: settings.dropboxToken,
          folder: settings.dropboxFolder
        })
      });
      
      const result = await response.json();
      setConnectionStatus(result);
      
      if (result.success) {
        toast.success('Dropbox connection successful!');
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus({ success: false, error: 'Network error' });
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    if (activeSection === 'settings' && canEdit) {
      loadSettings();
      loadStats();
    } else if (activeSection === 'projects') {
      loadCurrentProjects();
      loadCompleteProjects();
    } else if (activeSection === 'categories') {
      loadCategories();
    }
  }, [activeSection, canEdit]);

  const sections = [
    { id: 'tags', label: 'Tags Database', icon: Tags, description: 'Manage all tags and categories' },
    { id: 'projects', label: 'Projects', icon: Folder, description: 'Manage current projects and view automatic complete project creation' },
    { id: 'categories', label: 'Categories', icon: Layers, description: 'Manage image categories' },
    { id: 'policies', label: 'Image Policies', icon: FileText, description: 'View tagging and categorization rules' },
    { id: 'workflow', label: 'Pro Workflow', icon: RefreshCw, description: 'Advanced workflow tools and automation' },
  ];

  // Only show settings in edit mode
  if (canEdit) {
    sections.push({
      id: 'settings', 
      label: 'Settings', 
      icon: Settings, 
      description: 'Dropbox connection, folder structure and server configuration'
    });
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Central hub for image management and tagging system</p>
          </div>
          
          {/* Mode Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            {canEdit ? (
              <>
                <Edit3 className="h-3 w-3" />
                <span>Edit Mode</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                <span>View Mode</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeSection === section.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Section Description */}
        <div className="mt-4">
          <p className="text-gray-600">
            {sections.find(s => s.id === activeSection)?.description}
          </p>
        </div>
      </div>

      {/* Section Content */}
      <div>
        {activeSection === 'tags' && (
          <div>
            <div className="text-center py-12 bg-white">
              <Tags className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tags Database</h3>
              <p className="text-gray-600 mb-2">Tags management interface coming soon...</p>
              <p className="text-sm text-gray-500">
                View all existing tags, edit individual tags, and add new ones. 
                Hyperlinked to replace current Tags page functionality.
              </p>
            </div>
          </div>
        )}

        {activeSection === 'projects' && (
          <div className="space-y-6">
            {/* Current Projects Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Current Projects</h3>
                  <p className="text-gray-600">Manage active projects and create new ones</p>
                </div>
              </div>

              {/* New Project Form - Only show in edit mode */}
              {canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Create New Project</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Enter project name (e.g., 'Collins St')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && createNewProject()}
                    />
                    <button
                      onClick={createNewProject}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                      Create Project
                    </button>
                  </div>
                </div>
              )}

              {/* Current Projects List */}
              <div>
                {currentProjects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Folder className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No current projects found</p>
                    {canEdit && <p className="text-sm">Create your first project above</p>}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {currentProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Folder className="h-5 w-5 text-blue-500" />
                          <div>
                            <h4 className="font-medium text-gray-900">{project.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>Created {new Date(project.created).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                            title="Delete project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Complete Projects Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-6">
                <Check className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Complete Projects</h3>
              </div>
              
              {/* Complete Projects List */}
              <div className="mb-6">
                {completeProjects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Check className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No complete projects found</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {completeProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Check className="h-5 w-5 text-green-600" />
                          <div>
                            <h4 className="font-medium text-gray-900">{project.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>Complete Project</span>
                              <span>•</span>
                              <span>Tags: {project.tags.join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-green-600 font-medium">
                          Complete
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Automatic Creation Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Automatic Project Creation</h4>
                <p className="text-blue-800 text-sm mb-3">
                  Complete projects are automatically created when images are tagged with:
                </p>
                <div className="space-y-1 text-sm text-blue-800 font-mono bg-blue-100 p-3 rounded">
                  <div>• "archier" (team tag)</div>
                  <div>• "complete" (status tag)</div>
                  <div>• "[project name]" (specific project identifier)</div>
                </div>
                <p className="text-blue-800 text-sm mt-3">
                  These projects will automatically appear above and be organized in Dropbox under <code>/SnapTag/Archier/[Project]/</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'categories' && (
          <div className="space-y-6">
            {/* Categories Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Image Categories</h3>
                  <p className="text-gray-600">Categories used for organizing and classifying images</p>
                </div>
              </div>

              {/* Add New Category - Only show in edit mode */}
              {canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Add New Category</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Enter category name (e.g., 'Balconies')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                    />
                    <button
                      onClick={addCategory}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                      Add Category
                    </button>
                  </div>
                </div>
              )}

              {/* Categories List */}
              <div>
                {categories.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Layers className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No categories found</p>
                    {canEdit && <p className="text-sm">Add your first category above</p>}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        {editingCategory === category.id ? (
                          <EditCategoryForm
                            category={category}
                            onSave={updateCategory}
                            onCancel={() => setEditingCategory(null)}
                          />
                        ) : (
                          <>
                            <div className="flex items-center gap-3 flex-1">
                              <Layers className="h-5 w-5 text-blue-500" />
                              <div>
                                <h4 className="font-medium text-gray-900">{category.name}</h4>
                                <p className="text-sm text-gray-500">{category.description}</p>
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingCategory(category.id)}
                                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-md"
                                  title="Edit category"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteCategory(category.id)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                                  title="Delete category"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Types Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Image Types</h3>
                  <p className="text-gray-600">Types used for classifying image content and materials</p>
                </div>
              </div>

              {/* Add New Type - Only show in edit mode */}
              {canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Add New Type</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="Enter type name (e.g., 'Glass', 'Concrete')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addType()}
                    />
                    <button
                      onClick={addType}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                      <Plus className="h-4 w-4" />
                      Add Type
                    </button>
                  </div>
                </div>
              )}

              {/* Types List */}
              <div>
                {types.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Tags className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No types found</p>
                    {canEdit && <p className="text-sm">Add your first type above</p>}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {types.map((type) => (
                      <div
                        key={type.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        {editingType === type.id ? (
                          <EditTypeForm
                            type={type}
                            onSave={updateType}
                            onCancel={() => setEditingType(null)}
                          />
                        ) : (
                          <>
                            <div className="flex items-center gap-3 flex-1">
                              <Tags className="h-5 w-5 text-green-500" />
                              <div>
                                <h4 className="font-medium text-gray-900">{type.name}</h4>
                                <p className="text-sm text-gray-500">{type.description}</p>
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingType(type.id)}
                                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-md"
                                  title="Edit type"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteType(type.id)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                                  title="Delete type"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'policies' && (
          <div className="space-y-6">
            {/* Filename Format Policy */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Filename Format</h3>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-blue-900 mb-2">Standard Format:</h4>
                <div className="text-blue-800 font-mono text-sm bg-blue-100 p-3 rounded">
                  AXXXX-type-category.jpg
                </div>
                <div className="text-blue-800 text-sm mt-2 space-y-1">
                  <div>• <strong>A</strong> = Alphabetical prefix</div>
                  <div>• <strong>XXXX</strong> = 4-digit sequential number</div>
                  <div>• <strong>type</strong> = precedent, texture, or project-specific</div>
                  <div>• <strong>category</strong> = exteriors, interiors, kitchens, bathrooms, stairs, etc.</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Example Precedent:</h5>
                  <code className="text-blue-600">A0124-precedent-exteriors.jpg</code>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Example Texture:</h5>
                  <code className="text-blue-600">A0168-texture-tile.jpg</code>
                </div>
              </div>
            </div>

            {/* Tagging Policies */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Tags className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Tagging Policies</h3>
              </div>

              <div className="space-y-4">
                {/* Project Images */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium text-gray-900 mb-2">Project Images</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div><strong>Required Tags:</strong> project name (e.g., "de witt st", "couvreur")</div>
                    <div><strong>Status Tags:</strong> "wip" (work in progress) or "final" (completed)</div>
                    <div><strong>Completion Tags:</strong> "complete" + "archier" (automatically creates complete project)</div>
                    <div><strong>Category Tags:</strong> exteriors, interiors, kitchens, bathrooms, stairs, etc.</div>
                  </div>
                </div>

                {/* Precedent Images */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-medium text-gray-900 mb-2">Precedent Images</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div><strong>Required Tags:</strong> "precedent"</div>
                    <div><strong>Optional Project Tags:</strong> project name (for project-specific precedents)</div>
                    <div><strong>Category Tags:</strong> exteriors, interiors, general, stairs, etc.</div>
                    <div><strong>Usage:</strong> Reference images for design inspiration</div>
                  </div>
                </div>

                {/* Texture Images */}
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-medium text-gray-900 mb-2">Texture Images</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div><strong>Required Tags:</strong> "texture"</div>
                    <div><strong>Optional Project Tags:</strong> project name (for project-specific materials)</div>
                    <div><strong>Material Tags:</strong> tile, wood, stone, brick, carpet, metal, etc.</div>
                    <div><strong>Usage:</strong> Material samples and texture references</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Folder Structure Policy */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Folder className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Dropbox Organization</h3>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Automatic Folder Structure:</h4>
                <div className="text-sm text-gray-700 space-y-2 font-mono">
                  <div className="pl-0">📁 /SnapTag/</div>
                  <div className="pl-4">📁 Archier/ <span className="text-gray-500">(team projects)</span></div>
                  <div className="pl-8">📁 [Project Name]/ <span className="text-gray-500">(e.g., "De Witt St")</span></div>
                  <div className="pl-12">📁 Final/ <span className="text-gray-500">(images tagged "final")</span></div>
                  <div className="pl-12">📁 WIP/ <span className="text-gray-500">(images tagged "wip")</span></div>
                  <div className="pl-4">📁 Precedents/ <span className="text-gray-500">(reference images)</span></div>
                  <div className="pl-8">📁 [Category]/ <span className="text-gray-500">(exteriors, interiors, etc.)</span></div>
                  <div className="pl-4">📁 Materials/ <span className="text-gray-500">(texture images)</span></div>
                  <div className="pl-8">📁 [Material Type]/ <span className="text-gray-500">(tile, wood, stone, etc.)</span></div>
                </div>
              </div>
            </div>

            {/* Search and Filter Logic */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Search & Filter Logic</h3>
              </div>

              <div className="space-y-4">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">AND Logic (All Required)</h4>
                  <p className="text-yellow-800 text-sm mb-2">
                    Images must have ALL specified tags to appear in results:
                  </p>
                  <div className="text-yellow-800 text-sm space-y-1">
                    <div>• Project tab: project name + tab type (e.g., "de witt st" + "precedent")</div>
                    <div>• Photos tab: project name + "complete" + filter ("final" or "wip")</div>
                    <div>• Texture tab: project name + "texture"</div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Project Tab Behavior</h4>
                  <div className="text-green-800 text-sm space-y-1">
                    <div>• <strong>Current Projects:</strong> Precedent, Texture, Photos tabs</div>
                    <div>• <strong>Complete Projects:</strong> Final, WIP tabs (Photos tab with filters)</div>
                    <div>• <strong>Photos Tab:</strong> Only shows images with "complete" tag</div>
                    <div>• <strong>Filters:</strong> Final/WIP dropdown in Photos tab</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Lifecycle */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="h-5 w-5 text-teal-600" />
                <h3 className="text-lg font-semibold text-gray-900">Project Lifecycle</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 rounded-full p-2">
                    <span className="text-blue-600 font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Current Project Creation</h4>
                    <p className="text-gray-600 text-sm">Manual creation via Dashboard or Projects page</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-purple-100 rounded-full p-2">
                    <span className="text-purple-600 font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Image Collection</h4>
                    <p className="text-gray-600 text-sm">Add precedents, textures, and WIP images with project tags</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 rounded-full p-2">
                    <span className="text-orange-600 font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Project Completion</h4>
                    <p className="text-gray-600 text-sm">Tag final images with "complete" + "archier" + project name</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-green-100 rounded-full p-2">
                    <span className="text-green-600 font-bold text-sm">4</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Automatic Migration</h4>
                    <p className="text-gray-600 text-sm">Project automatically appears in Complete section with Final/WIP tabs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'workflow' && (
          <div className="space-y-6">
            {/* Pro Workflow Header */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Pro Workflow</h3>
              </div>
              <p className="text-gray-600">
                Advanced tools and automation for professional image management workflows.
              </p>
            </div>

            {/* Batch Operations */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Batch Operations</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Bulk Tagging</h4>
                  <p className="text-blue-800 text-sm mb-3">
                    Apply tags to multiple images simultaneously based on filename patterns or selections.
                  </p>
                  <div className="text-blue-800 text-sm space-y-1">
                    <div>• Pattern-based tagging (e.g., all *-precedent-* files)</div>
                    <div>• Project-specific bulk operations</div>
                    <div>• Category and type batch assignment</div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Folder Synchronization</h4>
                  <p className="text-green-800 text-sm mb-3">
                    Automatic organization and synchronization with Dropbox folder structure.
                  </p>
                  <div className="text-green-800 text-sm space-y-1">
                    <div>• Auto-move images based on tags</div>
                    <div>• Dropbox folder structure maintenance</div>
                    <div>• Duplicate detection and handling</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Automation Rules */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">Automation Rules</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-2">Auto-Tagging Rules</h4>
                  <p className="text-orange-800 text-sm mb-3">
                    Automatically apply tags based on filename patterns and content analysis.
                  </p>
                  <div className="text-orange-800 text-sm font-mono bg-orange-100 p-3 rounded space-y-1">
                    <div>AXXXX-precedent-exteriors.jpg → [precedent, exteriors]</div>
                    <div>AXXXX-texture-tile.jpg → [texture, tile]</div>
                    <div>Project images → [project-name, category]</div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">Project Lifecycle Automation</h4>
                  <p className="text-purple-800 text-sm mb-3">
                    Automated project status management and folder organization.
                  </p>
                  <div className="text-purple-800 text-sm space-y-1">
                    <div>• Auto-complete projects when tagged with "complete" + "archier"</div>
                    <div>• Move WIP images to Final folders when status changes</div>
                    <div>• Create project archives for completed work</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Control */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Check className="h-5 w-5 text-teal-600" />
                <h3 className="text-lg font-semibold text-gray-900">Quality Control</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Validation Checks</h4>
                  <div className="text-yellow-800 text-sm space-y-1">
                    <div>• Filename format compliance (AXXXX-type-category.jpg)</div>
                    <div>• Required tag validation</div>
                    <div>• Duplicate image detection</div>
                    <div>• Missing category assignments</div>
                  </div>
                </div>

                <div className="bg-teal-50 p-4 rounded-lg">
                  <h4 className="font-medium text-teal-900 mb-2">Data Integrity</h4>
                  <div className="text-teal-800 text-sm space-y-1">
                    <div>• Orphaned images (missing project references)</div>
                    <div>• Inconsistent tagging patterns</div>
                    <div>• Broken Dropbox synchronization</div>
                    <div>• Database consistency checks</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics & Reporting */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Analytics & Reporting</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h4 className="font-medium text-indigo-900 mb-2">Usage Statistics</h4>
                  <div className="text-indigo-800 text-sm space-y-1">
                    <div>• Images per project breakdown</div>
                    <div>• Most used categories and types</div>
                    <div>• Storage usage by project</div>
                    <div>• Tagging completion rates</div>
                  </div>
                </div>

                <div className="bg-pink-50 p-4 rounded-lg">
                  <h4 className="font-medium text-pink-900 mb-2">Project Reports</h4>
                  <div className="text-pink-800 text-sm space-y-1">
                    <div>• Project timeline and progress</div>
                    <div>• Image collection summaries</div>
                    <div>• Team collaboration metrics</div>
                    <div>• Export capabilities (PDF, CSV)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Tools */}
            {canEdit && (
              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Advanced Tools</h3>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">Edit Mode Only</span>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-900 mb-2">⚠️ Danger Zone</h4>
                    <div className="text-red-800 text-sm space-y-2">
                      <div>• Bulk delete operations</div>
                      <div>• Database cleanup and optimization</div>
                      <div>• Reset project configurations</div>
                      <div>• Force Dropbox re-synchronization</div>
                    </div>
                    <p className="text-red-700 text-xs mt-3 italic">
                      These operations cannot be undone. Use with extreme caution.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'settings' && canEdit && (
          <div className="space-y-6">
            {/* Settings Header */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                  <p className="text-gray-600">Configure Dropbox connection and server settings</p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSettings({
                        dropboxToken: '',
                        serverUrl: window.location.origin,
                        dropboxFolder: '/ARCHIER Team Folder/Support/Production/SnapTag',
                        autoBackup: true,
                        imageQuality: 85,
                        maxFileSize: 10,
                        defaultTags: '',
                        autoTagging: false,
                        metadataFormat: 'both'
                      });
                      toast.info('Settings reset to defaults');
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Reset to Defaults
                  </button>
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Connection Settings */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Connection Settings</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dropbox Access Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={settings.dropboxToken}
                      onChange={(e) => setSettings(prev => ({ ...prev, dropboxToken: e.target.value }))}
                      placeholder="Enter your Dropbox access token"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={testConnection}
                      disabled={testing || !settings.dropboxToken}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                    >
                      {testing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      Test
                    </button>
                  </div>
                  {connectionStatus && (
                    <div className={`mt-2 p-3 rounded-md flex items-center gap-2 ${
                      connectionStatus.success 
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {connectionStatus.success ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>
                        {connectionStatus.success 
                          ? 'Connection successful!' 
                          : `Error: ${connectionStatus.error}`
                        }
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dropbox Folder Path
                  </label>
                  <input
                    type="text"
                    value={settings.dropboxFolder}
                    onChange={(e) => setSettings(prev => ({ ...prev, dropboxFolder: e.target.value }))}
                    placeholder="/ARCHIER Team Folder/Support/Production/SnapTag"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Root folder where images will be stored in Dropbox
                  </p>
                </div>
              </div>
            </div>

            {/* Folder Structure Information */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Folder className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-semibold">Folder Structure</h3>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Current Organization:</h4>
                <div className="text-sm text-gray-700 space-y-1 font-mono">
                  <div>📁 /SnapTag/</div>
                  <div className="ml-4">📁 Archier/</div>
                  <div className="ml-8">📁 [Project Name]/</div>
                  <div className="ml-12">📁 Final/ → Images tagged "final"</div>
                  <div className="ml-12">📁 WIP/ → Images tagged "wip"</div>
                  <div className="ml-4">📁 Precedents/</div>
                  <div className="ml-8">📁 [Category]/ → exteriors, interiors, etc.</div>
                  <div className="ml-4">📁 Materials/</div>
                  <div className="ml-8">📁 [Material Type]/ → tile, wood, stone, etc.</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            {stats.totalImages && (
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold">Database Statistics</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalImages}</div>
                    <div className="text-sm text-gray-600">Total Images</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.totalTags}</div>
                    <div className="text-sm text-gray-600">Total Tags</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.uniqueSources}</div>
                    <div className="text-sm text-gray-600">Unique Sources</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(stats.totalFileSize / (1024 * 1024))} MB
                    </div>
                    <div className="text-sm text-gray-600">Total Size</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
