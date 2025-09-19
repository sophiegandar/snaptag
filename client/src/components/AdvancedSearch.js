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
  const [filters, setFilters] = useState({
    searchTerm: '',
    tags: [],
    dateRange: { start: '', end: '' },
    ...initialFilters
  });

  const [searchStats, setSearchStats] = useState(null);

  // Removed auto-search - searches now only happen on explicit user action

  const handleSearch = () => {
    const searchParams = {
      ...filters,
      tags: filters.tags.filter(Boolean)
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
      hasAdvancedFilters: activeFilters.some(f => f !== 'searchTerm')
    });

    onSearch(searchParams);
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      tags: [],
      dateRange: { start: '', end: '' }
    });
    // Trigger search with empty filters
    onSearch({});
  };


  const clearAllFilters = () => {
    setFilters({
      searchTerm: '',
      tags: [],
      dateRange: { start: '', end: '' }
    });
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
            onClick={clearFilters}
            className="flex items-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 hover:text-gray-800"
            title="Clear all search terms and filters"
          >
            <X className="h-4 w-4" />
            <span>Clear</span>
          </button>
          
        </div>
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="p-4 space-y-6">


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