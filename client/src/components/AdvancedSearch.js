import React, { useState } from 'react';
import { 
  Search, 
  X
} from 'lucide-react';

const AdvancedSearch = ({ onSearch, initialFilters = {} }) => {
  const [filters, setFilters] = useState({
    searchTerm: '',
    tags: [],
    dateRange: { start: '', end: '' },
    ...initialFilters
  });


  // Removed auto-search - searches now only happen on explicit user action

  const handleSearch = () => {
    const searchParams = {
      ...filters,
      tags: filters.tags.filter(Boolean)
    };

    // Search stats calculation removed

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

    </div>
  );
};

export default AdvancedSearch; 