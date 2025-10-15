import React from 'react';
import { Loader2, Image, Upload, Search, Database, Settings } from 'lucide-react';

const LoadingSpinner = ({ 
  size = 'medium', 
  message = 'Loading...', 
  type = 'default',
  fullScreen = false,
  overlay = false 
}) => {
  // Size configurations
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8', 
    large: 'h-12 w-12',
    xlarge: 'h-16 w-16'
  };

  // Type-specific icons and messages
  const typeConfig = {
    default: { icon: Loader2, color: 'text-blue-500' },
    images: { icon: Image, color: 'text-green-500', message: 'Loading images...' },
    upload: { icon: Upload, color: 'text-purple-500', message: 'Uploading...' },
    search: { icon: Search, color: 'text-orange-500', message: 'Searching...' },
    database: { icon: Database, color: 'text-indigo-500', message: 'Connecting to database...' },
    settings: { icon: Settings, color: 'text-gray-500', message: 'Loading settings...' }
  };

  const config = typeConfig[type] || typeConfig.default;
  const IconComponent = config.icon;
  const displayMessage = message === 'Loading...' ? (config.message || message) : message;

  const spinnerContent = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <IconComponent 
        className={`${sizeClasses[size]} ${config.color} animate-spin`}
      />
      {displayMessage && (
        <p className="text-sm text-gray-600 font-medium">
          {displayMessage}
        </p>
      )}
    </div>
  );

  // Full screen loading
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        {spinnerContent}
      </div>
    );
  }

  // Overlay loading (over existing content)
  if (overlay) {
    return (
      <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-40">
        {spinnerContent}
      </div>
    );
  }

  // Inline loading
  return (
    <div className="flex items-center justify-center p-8">
      {spinnerContent}
    </div>
  );
};

// Specialized loading components for common use cases
export const ImageLoadingSpinner = ({ message = 'Loading images...', ...props }) => (
  <LoadingSpinner type="images" message={message} {...props} />
);

export const UploadLoadingSpinner = ({ message = 'Uploading files...', ...props }) => (
  <LoadingSpinner type="upload" message={message} {...props} />
);

export const SearchLoadingSpinner = ({ message = 'Searching...', ...props }) => (
  <LoadingSpinner type="search" message={message} {...props} />
);

export const DatabaseLoadingSpinner = ({ message = 'Connecting...', ...props }) => (
  <LoadingSpinner type="database" message={message} {...props} />
);

// Skeleton loading for image grids
export const ImageGridSkeleton = ({ count = 12 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="aspect-square bg-gray-200 rounded-lg animate-pulse">
        <div className="w-full h-full flex items-center justify-center">
          <Image className="h-8 w-8 text-gray-400" />
        </div>
      </div>
    ))}
  </div>
);

// Loading state for project cards
export const ProjectCardSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="aspect-square bg-gray-200 animate-pulse flex items-center justify-center">
          <Image className="h-12 w-12 text-gray-400" />
        </div>
        <div className="p-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3"></div>
        </div>
      </div>
    ))}
  </div>
);

export default LoadingSpinner;
