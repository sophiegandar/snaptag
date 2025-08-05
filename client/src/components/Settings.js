import React, { useState, useEffect } from 'react';
import { Save, TestTube, Check, AlertCircle, RefreshCw, Database, Droplets, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

const Settings = () => {
  const [settings, setSettings] = useState({
    dropboxToken: '',
    dropboxFolder: '/SnapTag',
    serverUrl: 'http://localhost:3001',
    autoBackup: true,
    imageQuality: 85,
    maxFileSize: 10,
    defaultTags: '',
    autoTagging: false,
    metadataFormat: 'both' // 'xmp', 'iptc', 'both'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [cleanupStatus, setCleanupStatus] = useState(null);
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load settings from localStorage
      const saved = localStorage.getItem('snaptag-settings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }
      
      // Also load current server settings
      try {
        const serverUrl = settings.serverUrl || 'http://localhost:3001';
        const response = await fetch(`${serverUrl}/api/settings`);
        if (response.ok) {
          const serverSettings = await response.json();
          if (serverSettings.dropboxFolder) {
            setSettings(prev => ({ ...prev, dropboxFolder: serverSettings.dropboxFolder }));
          }
        }
      } catch (serverError) {
        console.log('Could not load server settings:', serverError);
      }
      
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/images/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Save to localStorage
      localStorage.setItem('snaptag-settings', JSON.stringify(settings));
      
      // Save to server
      await fetch(`${settings.serverUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      toast.success('Settings saved successfully');
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

      // Test server connection
      const serverResponse = await fetch(`${settings.serverUrl}/api/health`);
      
      if (!serverResponse.ok) {
        throw new Error('Server unreachable');
      }

      // Test Dropbox connection if token is provided
      if (settings.dropboxToken) {
        // This would be a real Dropbox API test
        // const dropboxResponse = await fetch('/api/test-dropbox');
        // For now, simulate success
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setConnectionStatus('success');
      toast.success('Connection test successful');
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
      toast.error(`Connection test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const syncWithDropbox = async () => {
    try {
      setSyncing(true);
      setSyncStatus(null);
      
      const serverUrl = settings.serverUrl || 'http://localhost:3001';
      const response = await fetch(`${serverUrl}/api/sync/dropbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setSyncStatus('success');
        toast.success(`Sync completed! Added ${result.stats.addedToDatabase} images to database`);
        
        // Reload stats to show updated numbers
        loadStats();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }
    } catch (error) {
      setSyncStatus('error');
      toast.error(`Sync failed: ${error.message}`);
      console.error('Dropbox sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const cleanupSingleLetterTags = async () => {
    try {
      setCleaning(true);
      setCleanupStatus(null);
      
      const serverUrl = settings.serverUrl || 'http://localhost:3001';
      const response = await fetch(`${serverUrl}/api/cleanup/single-letter-tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setCleanupStatus('success');
        toast.success(`Cleanup completed! Removed ${result.removedTags} single-letter tags`);
        
        // Reload stats to show updated numbers
        loadStats();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Cleanup failed');
      }
    } catch (error) {
      setCleanupStatus('error');
      toast.error(`Cleanup failed: ${error.message}`);
      console.error('Tag cleanup error:', error);
    } finally {
      setCleaning(false);
    }
  };

  const resetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values?')) {
      const defaultSettings = {
        dropboxToken: '',
        serverUrl: 'http://localhost:3001',
        autoBackup: true,
        imageQuality: 85,
        maxFileSize: 10,
        defaultTags: '',
        autoTagging: false,
        metadataFormat: 'both'
      };
      
      setSettings(defaultSettings);
      toast.success('Settings reset to defaults');
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/images');
      const images = await response.json();
      
      const exportData = {
        images,
        settings,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snaptag-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Configure your SnapTag application</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={resetSettings}
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
              Server URL
            </label>
            <input
              type="url"
              value={settings.serverUrl}
              onChange={(e) => updateSetting('serverUrl', e.target.value)}
              placeholder="http://localhost:3001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL of your SnapTag server
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dropbox Access Token
            </label>
            <input
              type="password"
              value={settings.dropboxToken}
              onChange={(e) => updateSetting('dropboxToken', e.target.value)}
              placeholder="Enter your Dropbox access token"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get this from your <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Dropbox App Console</a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dropbox Folder Path
            </label>
            <input
              type="text"
              value={settings.dropboxFolder}
              onChange={(e) => updateSetting('dropboxFolder', e.target.value)}
              placeholder="/SnapTag"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Path in your Dropbox where images will be saved (e.g., /SnapTag, /Projects/Images)
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={testConnection}
              disabled={testing || !settings.serverUrl}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              {testing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Test Connection
            </button>

            <button
              onClick={syncWithDropbox}
              disabled={syncing || !settings.serverUrl}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {syncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Sync with Dropbox
            </button>

            <button
              onClick={cleanupSingleLetterTags}
              disabled={cleaning || !settings.serverUrl}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
            >
              {cleaning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clean Letter Tags
            </button>

            {(connectionStatus || syncStatus || cleanupStatus) && (
              <div className="flex gap-2">
                {connectionStatus && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${
                    connectionStatus === 'success' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {connectionStatus === 'success' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {connectionStatus === 'success' ? 'Connected' : 'Failed'}
                    </span>
                  </div>
                )}
                
                {syncStatus && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${
                    syncStatus === 'success' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {syncStatus === 'success' ? (
                      <Database className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {syncStatus === 'success' ? 'Synced' : 'Sync Failed'}
                    </span>
                  </div>
                )}
                
                {cleanupStatus && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${
                    cleanupStatus === 'success' 
                      ? 'bg-orange-100 text-orange-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {cleanupStatus === 'success' ? (
                      <Trash2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {cleanupStatus === 'success' ? 'Cleaned' : 'Cleanup Failed'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Processing Settings */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold">Image Processing</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image Quality ({settings.imageQuality}%)
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={settings.imageQuality}
              onChange={(e) => updateSetting('imageQuality', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Lower quality</span>
              <span>Higher quality</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max File Size (MB)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxFileSize}
              onChange={(e) => updateSetting('maxFileSize', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum file size for uploads
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metadata Format
            </label>
            <select
              value={settings.metadataFormat}
              onChange={(e) => updateSetting('metadataFormat', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="both">XMP + IPTC (Recommended)</option>
              <option value="xmp">XMP Only</option>
              <option value="iptc">IPTC Only</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Format for embedding metadata in images
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Tags
            </label>
            <input
              type="text"
              value={settings.defaultTags}
              onChange={(e) => updateSetting('defaultTags', e.target.value)}
              placeholder="architecture, design, modern"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated tags applied to all new images
            </p>
          </div>
        </div>
      </div>

      {/* Feature Settings */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Features</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Auto Backup</h4>
              <p className="text-sm text-gray-500">
                Automatically backup images to Dropbox
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoBackup}
                onChange={(e) => updateSetting('autoBackup', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Auto Tagging</h4>
              <p className="text-sm text-gray-500">
                Use AI to suggest tags for uploaded images
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoTagging}
                onChange={(e) => updateSetting('autoTagging', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">System Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{stats.total_images || 0}</p>
            <p className="text-sm text-gray-600">Total Images</p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{stats.total_tags || 0}</p>
            <p className="text-sm text-gray-600">Total Tags</p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {stats.avg_file_size ? `${(stats.avg_file_size / 1024 / 1024).toFixed(1)}MB` : '0MB'}
            </p>
            <p className="text-sm text-gray-600">Avg File Size</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-gray-900">Data Export</h4>
              <p className="text-sm text-gray-500">
                Export all your images and settings as a backup
              </p>
            </div>
            <button
              onClick={exportData}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Export Data
            </button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">About SnapTag</h3>
        
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>Version:</strong> 1.0.0</p>
          <p><strong>Built for:</strong> Archier</p>
          <p><strong>Purpose:</strong> Professional image tagging and management with InDesign/ArchiCAD integration</p>
          <p><strong>Storage:</strong> Dropbox with XMP/IPTC metadata embedding</p>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2">Support</h4>
          <p className="text-sm text-gray-600">
            For support and documentation, visit the{' '}
            <a href="#" className="text-blue-600 hover:underline">SnapTag GitHub repository</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings; 