import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Tag, 
  Image as ImageIcon, 
  SortAsc, 
  SortDesc,
  X,
  ChevronDown,
  ChevronUp,
  Sliders
} from 'lucide-react';
import { apiCall } from '../utils/apiConfig';

const AdvancedSearch = ({ onSearch, initialFilters = {} }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    searchTerm: '',
    tags: [],
    dateRange: { start: '', end: '' },
    sizeRange: { min: 0, max: 10000000 }, // bytes
    dimensions: { minWidth: 0, minHeight: 0 },
    contentType: [],
    sourceFilter: '',
    sortBy: 'upload_date',
    sortOrder: 'desc',
    ...initialFilters
  });

  const [availableTags, setAvailableTags] = useState([]);
  const [availableSources, setAvailableSources] = useState([]);
  const [searchStats, setSearchStats] = useState(null);

  const contentTypes = [
    { value: 'exterior', label: 'Exterior', icon: '🏢' },
    { value: 'interior', label: 'Interior', icon: '🛋️' },
    { value: 'detail', label: 'Detail', icon: '🔍' },
    { value: 'plan', label: 'Plans', icon: '📐' },
    { value: 'construction', label: 'Construction', icon: '🚧' },
    { value: 'landscape', label: 'Landscape', icon: '🌿' }
  ];

  const sortOptions = [
    { value: 'upload_date', label: 'Upload Date' },
    { value: 'title', label: 'Title' },
    { value: 'filename', label: 'Filename' },
    { value: 'file_size', label: 'File Size' },
    { value: 'width', label: 'Width' },
    { value: 'height', label: 'Height' }
  ];

  const sizePresets = [
    { label: 'Any Size', min: 0, max: 10000000 },
    { label: 'Small (< 500KB)', min: 0, max: 500000 },
    { label: 'Medium (500KB - 2MB)', min: 500000, max: 2000000 },
    { label: 'Large (2MB - 5MB)', min: 2000000, max: 5000000 },
    { label: 'Very Large (> 5MB)', min: 5000000, max: 10000000 }
  ];

  useEffect(() => {
    loadAvailableTags();
    loadAvailableSources();
  }, []);

  // Removed auto-search - searches now only happen on explicit user action

  const loadAvailableTags = async () => {
    try {
      const response = await apiCall('/api/tags');
      const tags = await response.json();
      setAvailableTags(tags.map(tag => ({ ...tag, selected: false })));
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadAvailableSources = async () => {
    try {
      const response = await apiCall('/api/images/sources');
      const sources = await response.json();
      setAvailableSources(sources || []);
    } catch (error) {
      console.error('Error loading sources:', error);
      // Fallback to common architecture sources
      setAvailableSources([
        'archier.com.au', 'dezeen.com', 'archdaily.com', 'architectural-review.com',
        'inhabitat.com', 'dwell.com', 'curbed.com'
      ]);
    }
  };

  const handleSearch = () => {
    const searchParams = {
      ...filters,
      tags: filters.tags.filter(Boolean),
      contentType: filters.contentType.filter(Boolean)
    };

    // Calculate search stats
    const activeFilters = Object.keys(searchParams).filter(key => {
      const value = searchParams[key];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== '' && v !== 0);
      }
      return false;
    });

    setSearchStats({
      activeFilters: activeFilters.length,
      hasAdvancedFilters: activeFilters.some(f => f !== 'searchTerm' && f !== 'sortBy' && f !== 'sortOrder')
    });

    onSearch(searchParams);
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tagName) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
        : [...prev.tags, tagName]
    }));
  };

  const toggleContentType = (type) => {
    setFilters(prev => ({
      ...prev,
      contentType: prev.contentType.includes(type)
        ? prev.contentType.filter(t => t !== type)
        : [...prev.contentType, type]
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      searchTerm: '',
      tags: [],
      dateRange: { start: '', end: '' },
      sizeRange: { min: 0, max: 10000000 },
      dimensions: { minWidth: 0, minHeight: 0 },
      contentType: [],
      sourceFilter: '',
      sortBy: 'upload_date',
      sortOrder: 'desc'
    });
  };

  const setSizePreset = (preset) => {
    updateFilter('sizeRange', { min: preset.min, max: preset.max });
  };

  const toggleSortOrder = () => {
    updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg shadow-md mb-6">
      {/* Basic Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search images by title, description, filename..."
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Search
          </button>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center space-x-2 px-4 py-3 border rounded-lg transition-colors ${
              isExpanded ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Sliders className="h-5 w-5" />
            <span>Filters</span>
            {searchStats && searchStats.activeFilters > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1">
                {searchStats.activeFilters}
              </span>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Sort Options */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Sort</h3>
            <div className="flex items-center space-x-3">
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              <button
                onClick={toggleSortOrder}
                className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {filters.sortOrder === 'asc' ? 
                  <SortAsc className="h-4 w-4" /> : 
                  <SortDesc className="h-4 w-4" />
                }
                <span>{filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
              </button>
            </div>
          </div>

          {/* Tags Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {availableTags.slice(0, 12).map(tag => (
                <button
                  key={tag.name}
                  onClick={() => toggleTag(tag.name)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    filters.tags.includes(tag.name)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {tag.name}
                  {tag.usage_count && (
                    <span className="ml-1 text-xs opacity-75">({tag.usage_count})</span>
                  )}
                </button>
              ))}
            </div>
            {filters.tags.length > 0 && (
              <div className="mt-2">
                <span className="text-sm text-gray-500">Selected: </span>
                {filters.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1"
                  >
                    <span>{tag}</span>
                    <button onClick={() => toggleTag(tag)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content Type Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Content Type</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {contentTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => toggleContentType(type.value)}
                  className={`flex items-center space-x-2 p-3 text-sm rounded-lg border transition-colors ${
                    filters.contentType.includes(type.value)
                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{type.icon}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File Size Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">File Size</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {sizePresets.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => setSizePreset(preset)}
                    className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                      filters.sizeRange.min === preset.min && filters.sizeRange.max === preset.max
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min Size</label>
                  <input
                    type="number"
                    placeholder="Min bytes"
                    value={filters.sizeRange.min}
                    onChange={(e) => updateFilter('sizeRange', { 
                      ...filters.sizeRange, 
                      min: parseInt(e.target.value) || 0 
                    })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">
                    {formatFileSize(filters.sizeRange.min)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Size</label>
                  <input
                    type="number"
                    placeholder="Max bytes"
                    value={filters.sizeRange.max}
                    onChange={(e) => updateFilter('sizeRange', { 
                      ...filters.sizeRange, 
                      max: parseInt(e.target.value) || 10000000 
                    })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">
                    {formatFileSize(filters.sizeRange.max)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Upload Date</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => updateFilter('dateRange', { 
                    ...filters.dateRange, 
                    start: e.target.value 
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => updateFilter('dateRange', { 
                    ...filters.dateRange, 
                    end: e.target.value 
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Source Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Source Website</h3>
            <select
              value={filters.sourceFilter}
              onChange={(e) => updateFilter('sourceFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Sources</option>
              {availableSources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={clearAllFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all filters
            </button>
            
            {searchStats && (
              <div className="text-sm text-gray-500">
                {searchStats.activeFilters} active filter{searchStats.activeFilters !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch; 