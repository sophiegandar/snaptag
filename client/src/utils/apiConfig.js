// API Configuration utility
// Automatically detects environment and provides correct API base URL

const getApiBaseUrl = () => {
  // If we're in development (localhost), use localhost:3001
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // If we're in production (Railway or any other domain), use relative URLs
  // This works because the frontend and backend are served from the same domain
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function for making API calls
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, options);
}; 