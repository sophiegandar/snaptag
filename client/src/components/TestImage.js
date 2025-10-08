import React from 'react';

const TestImage = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Image Test</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Test 1: Direct Dropbox URL</h2>
          <img 
            src="https://dl.dropboxusercontent.com/scl/fi/example/test.jpg" 
            alt="Test 1"
            className="w-64 h-64 border border-gray-300"
            onError={(e) => console.log('Test 1 failed')}
            onLoad={() => console.log('Test 1 loaded')}
          />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Test 2: API Endpoint</h2>
          <img 
            src="/api/images/1/url" 
            alt="Test 2"
            className="w-64 h-64 border border-gray-300"
            onError={(e) => console.log('Test 2 failed')}
            onLoad={() => console.log('Test 2 loaded')}
          />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Test 3: Placeholder</h2>
          <img 
            src="/api/placeholder-image.jpg" 
            alt="Test 3"
            className="w-64 h-64 border border-gray-300"
            onError={(e) => console.log('Test 3 failed')}
            onLoad={() => console.log('Test 3 loaded')}
          />
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Test 4: Static Image</h2>
          <img 
            src="https://via.placeholder.com/300x300/0000FF/FFFFFF?text=TEST" 
            alt="Test 4"
            className="w-64 h-64 border border-gray-300"
            onError={(e) => console.log('Test 4 failed')}
            onLoad={() => console.log('Test 4 loaded')}
          />
        </div>
      </div>
    </div>
  );
};

export default TestImage;
