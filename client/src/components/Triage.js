import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Tag, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  RefreshCw,
  Plus,
  Search
} from 'lucide-react';
import { toast } from 'react-toastify';
import { apiCall } from '../utils/apiConfig';

const Triage = () => {
  const [stats, setStats] = useState(null);
  const [untaggedImages, setUntaggedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUntagged, setShowUntagged] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [quickTags, setQuickTags] = useState('');

  useEffect(() => {
    loadTriageStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadTriageStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTriageStats = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/triage/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        
        // Show alerts if there are issues
        if (data.alerts.critical) {
          toast.warn(`${data.stats.untaggedImages} untagged images need attention!`, {
            autoClose: 8000
          });
        }
        if (data.alerts.recent) {
          toast.info(`${data.stats.recentUntagged} recently added images are untagged`, {
            autoClose: 5000
          });
        }
      }
    } catch (error) {
      console.error('Error loading triage stats:', error);
      toast.error('Failed to load triage statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadUntaggedImages = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/images/untagged');
      const data = await response.json();
      
      if (data.success) {
        setUntaggedImages(data.images);
        setShowUntagged(true);
        toast.info(data.message);
      }
    } catch (error) {
      console.error('Error loading untagged images:', error);
      toast.error('Failed to load untagged images');
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = (imageId) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllUntagged = () => {
    setSelectedImages(untaggedImages.map(img => img.id));
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const applyQuickTags = async () => {
    if (selectedImages.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    if (!quickTags.trim()) {
      toast.error('Please enter at least one tag');
      return;
    }

    const tags = quickTags.split(',').map(tag => tag.trim()).filter(Boolean);
    
    try {
      setLoading(true);
      const response = await apiCall('/api/batch/apply-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds: selectedImages,
          tags: tags
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        
        // Refresh data
        await loadTriageStats();
        await loadUntaggedImages();
        
        // Clear selections
        setSelectedImages([]);
        setQuickTags('');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Error applying quick tags:', error);
      toast.error('Failed to apply tags');
    } finally {
      setLoading(false);
    }
  };

  const getAlertLevel = () => {
    if (!stats) return 'info';
    if (stats.untaggedImages > 10) return 'critical';
    if (stats.untaggedImages > 5) return 'warning';
    if (stats.untaggedImages > 0) return 'info';
    return 'success';
  };

  const getAlertColor = (level) => {
    switch (level) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading triage data...</span>
      </div>
    );
  }

  const alertLevel = getAlertLevel();

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Image Triage</h1>
        <p className="text-gray-600">
          Identify and manage untagged images that need attention
        </p>
      </div>

      {/* Alert Banner */}
      {stats && stats.untaggedImages > 0 && (
        <div className={`rounded-lg border-2 p-4 mb-6 ${getAlertColor(alertLevel)}`}>
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 mr-3" />
            <div>
              <h3 className="font-semibold">
                {stats.untaggedImages} Untagged Image{stats.untaggedImages !== 1 ? 's' : ''} Found
              </h3>
              <p className="text-sm mt-1">
                These images are not properly organized and may be difficult to find.
                {stats.recentUntagged > 0 && ` ${stats.recentUntagged} were added in the last 7 days.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Images</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalImages || 0}</p>
            </div>
            <Search className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tagged</p>
              <p className="text-2xl font-bold text-green-600">{stats?.taggedImages || 0}</p>
              <p className="text-xs text-gray-500">{stats?.taggedPercentage || 0}% complete</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Untagged</p>
              <p className="text-2xl font-bold text-red-600">{stats?.untaggedImages || 0}</p>
              <p className="text-xs text-gray-500">Need immediate attention</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Minimal Tags</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.minimalTagsImages || 0}</p>
              <p className="text-xs text-gray-500">1-2 tags only</p>
            </div>
            <TrendingUp className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={loadUntaggedImages}
          disabled={loading || (stats?.untaggedImages === 0)}
          className="bg-red-500 text-white px-6 py-2 rounded-md hover:bg-red-600 disabled:opacity-50 flex items-center"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Show Untagged Images ({stats?.untaggedImages || 0})
        </button>
        
        <button
          onClick={loadTriageStats}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Untagged Images Section */}
      {showUntagged && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Untagged Images ({untaggedImages.length})
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={selectAllUntagged}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200"
                >
                  Clear Selection
                </button>
                <span className="text-sm text-gray-600">
                  {selectedImages.length} selected
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tagging */}
          {selectedImages.length > 0 && (
            <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <Tag className="h-5 w-5 text-blue-500" />
                <input
                  type="text"
                  value={quickTags}
                  onChange={(e) => setQuickTags(e.target.value)}
                  placeholder="Enter tags (comma-separated): archier, facade, glazing..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={applyQuickTags}
                  disabled={loading || !quickTags.trim()}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Apply to {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Images Grid */}
          <div className="p-6">
            {untaggedImages.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">All Images Tagged!</h3>
                <p className="text-gray-600">Every image in your collection has been properly tagged.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {untaggedImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImages.includes(image.id)
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleImageSelection(image.id)}
                  >
                    <div className="aspect-square">
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    
                    {selectedImages.includes(image.id) && (
                      <div className="absolute top-2 right-2">
                        <div className="bg-blue-500 text-white rounded-full p-1">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-white text-xs font-medium truncate">
                        {image.filename}
                      </p>
                      <div className="flex items-center mt-1">
                        <Clock className="h-3 w-3 text-white/80 mr-1" />
                        <p className="text-white/80 text-xs">
                          {new Date(image.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Triage; 