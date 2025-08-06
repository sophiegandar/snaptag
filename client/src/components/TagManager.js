import React, { useState, useEffect } from 'react';
import { Tag, Hash, Trash2, Edit, Plus, BarChart3, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiCall } from '../utils/apiConfig';

const TagManager = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [sortBy, setSortBy] = useState('usage');
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadTags();
    loadStats();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/tags');
      if (!response.ok) throw new Error('Failed to load tags');
      
      const data = await response.json();
      setTags(data);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiCall('/api/images/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const addTag = async () => {
    if (!newTagName.trim()) return;

    try {
      // For now, we'll add it locally since we don't have a specific API endpoint
      // In a real implementation, you'd want a POST /api/tags endpoint
      const newTag = {
        id: Date.now(),
        name: newTagName.trim(),
        usage_count: 0,
        color: generateTagColor()
      };

      setTags(prev => [...prev, newTag]);
      setNewTagName('');
      toast.success('Tag added successfully');
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Failed to add tag');
    }
  };

  const updateTag = async (tagId, newName) => {
    try {
      // Update locally for now
      setTags(prev => prev.map(tag => 
        tag.id === tagId ? { ...tag, name: newName.trim() } : tag
      ));
      
      setEditingTag(null);
      setEditValue('');
      toast.success('Tag updated successfully');
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error('Failed to update tag');
    }
  };

  const deleteTag = async (tagId, tagName) => {
    if (!window.confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove it from all images.`)) {
      return;
    }

    try {
      const response = await apiCall(`/api/tags/${tagId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete tag');
      }

      // Remove from local state
      setTags(prev => prev.filter(tag => tag.id !== tagId));
      toast.success('Tag deleted successfully');
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Failed to delete tag');
    }
  };

  const generateTagColor = () => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308',
      '#84cc16', '#22c55e', '#10b981', '#14b8a6',
      '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
      '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const startEditing = (tag) => {
    setEditingTag(tag.id);
    setEditValue(tag.name);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditValue('');
  };

  const handleKeyPress = (e, action, ...args) => {
    if (e.key === 'Enter') {
      action(...args);
    } else if (e.key === 'Escape' && action === updateTag) {
      cancelEditing();
    }
  };

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedTags = [...filteredTags].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'usage':
        return (b.usage_count || 0) - (a.usage_count || 0);
      case 'recent':
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Loading tags...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tag Management</h1>
            <p className="text-gray-600">Manage your image tag vocabulary</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {tags.length} tags total
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Tags</p>
                <p className="text-2xl font-bold text-blue-900">{tags.length}</p>
              </div>
              <Tag className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Total Images</p>
                <p className="text-2xl font-bold text-green-900">{stats.total_images || 0}</p>
              </div>
              <Hash className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Avg Tags/Image</p>
                <p className="text-2xl font-bold text-purple-900">
                  {stats.total_images ? (tags.reduce((sum, tag) => sum + (tag.usage_count || 0), 0) / stats.total_images).toFixed(1) : '0'}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">Unused Tags</p>
                <p className="text-2xl font-bold text-orange-900">
                  {tags.filter(tag => (tag.usage_count || 0) === 0).length}
                </p>
              </div>
              <Trash2 className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Add New Tag */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Tag className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Add new tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, addTag)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={addTag}
            disabled={!newTagName.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Tag
          </button>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="usage">Sort by Usage</option>
            <option value="name">Sort by Name</option>
            <option value="recent">Sort by Recent</option>
          </select>
        </div>
      </div>

      {/* Tags List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Tags ({filteredTags.length})
          </h3>
        </div>

        {sortedTags.length === 0 ? (
          <div className="p-8 text-center">
            <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No tags found' : 'No tags yet'}
            </h3>
            <p className="text-gray-500">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Add your first tag above to get started'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedTags.map(tag => (
              <div key={tag.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color || '#3b82f6' }}
                    />
                    
                    {editingTag === tag.id ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, () => updateTag(tag.id, editValue))}
                        onBlur={() => updateTag(tag.id, editValue)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div>
                        <h4 className="font-medium text-gray-900">{tag.name}</h4>
                        <p className="text-sm text-gray-500">
                          Used in {tag.usage_count || 0} image{(tag.usage_count || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
                      {tag.usage_count || 0}
                    </span>
                    
                    {editingTag === tag.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateTag(tag.id, editValue)}
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1 text-gray-600 hover:text-gray-800"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing(tag)}
                          className="p-1 text-gray-600 hover:text-blue-600"
                          title="Edit tag"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteTag(tag.id, tag.name)}
                          className="p-1 text-gray-600 hover:text-red-600"
                          title="Delete tag"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Analysis */}
      {tags.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-gray-900 mb-4">Tag Usage Analysis</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Most Used Tags</h4>
              <div className="flex flex-wrap gap-2">
                {[...tags]
                  .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
                  .slice(0, 10)
                  .map(tag => (
                    <span
                      key={tag.id}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      {tag.name}
                      <span className="bg-blue-200 px-1 rounded text-xs">
                        {tag.usage_count || 0}
                      </span>
                    </span>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Unused Tags</h4>
              <div className="flex flex-wrap gap-2">
                {tags
                  .filter(tag => (tag.usage_count || 0) === 0)
                  .slice(0, 10)
                  .map(tag => (
                    <span
                      key={tag.id}
                      className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm"
                    >
                      {tag.name}
                    </span>
                  ))}
                
                {tags.filter(tag => (tag.usage_count || 0) === 0).length === 0 && (
                  <span className="text-gray-500 text-sm">All tags are being used! 🎉</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagManager; 