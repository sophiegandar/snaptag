import React, { useState, useEffect } from 'react';
import { Database, Tags, Folder, Settings, Eye, Edit3, FileText, Layers, Save, TestTube, Check, AlertCircle, RefreshCw, Droplets, Copy, Search, Plus, Trash2, Calendar } from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { toast } from 'react-toastify';

const Dashboard = () => {
  const { canEdit } = useMode();
  const [activeSection, setActiveSection] = useState('tags');

  // Projects state
  const [currentProjects, setCurrentProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');

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
    }
  }, [activeSection, canEdit]);

  const sections = [
    { id: 'tags', label: 'Tags Database', icon: Tags, description: 'Manage all tags and categories' },
    { id: 'projects', label: 'Projects', icon: Folder, description: 'Manage current projects and view automatic complete project creation' },
    { id: 'categories', label: 'Categories', icon: Layers, description: 'Manage image categories' },
    { id: 'policies', label: 'Image Policies', icon: FileText, description: 'View tagging and categorization rules' },
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

            {/* Complete Projects Information */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Check className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Complete Projects</h3>
              </div>
              
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
                  These projects will automatically appear in the "Complete" projects section 
                  and be organized in Dropbox under <code>/SnapTag/Archier/[Project]/</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'categories' && (
          <div>
            <div className="text-center py-12 bg-white">
              <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Categories</h3>
              <p className="text-gray-600 mb-2">Categories management interface coming soon...</p>
              <p className="text-sm text-gray-500">
                Manage image categories like exteriors, interiors, kitchens, bathrooms, etc.
              </p>
            </div>
          </div>
        )}

        {activeSection === 'policies' && (
          <div>
            <div className="text-center py-12 bg-white">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Image Policies</h3>
              <p className="text-gray-600 mb-2">Image policies and tagging rules interface coming soon...</p>
              <p className="text-sm text-gray-500">
                View how images are defined, tagging policies, and categorization rules.
                Available in both view and edit modes.
              </p>
            </div>
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
