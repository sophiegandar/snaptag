import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { Search, Upload, Image as ImageIcon, Tag, Settings as SettingsIcon, Zap, FileText } from 'lucide-react';

import ImageGallery from './components/ImageGallery';
import ImageUpload from './components/ImageUpload';
import ImageEditor from './components/ImageEditor';
import TagManager from './components/TagManager';
import Settings from './components/Settings';
import BatchProcessing from './components/BatchProcessing';
import ProfessionalWorkflow from './components/ProfessionalWorkflow';

import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Navigation */}
        <nav className="bg-white shadow-lg border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="flex items-center space-x-2">
                  <ImageIcon className="h-8 w-8 text-blue-600" />
                  <span className="text-xl font-bold text-gray-900">SnapTag</span>
                </Link>
              </div>
              
              <div className="flex items-center space-x-4">
                <Link
                  to="/"
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                >
                  <Search className="h-4 w-4" />
                  <span>Gallery</span>
                </Link>
                
                <Link
                  to="/upload"
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload</span>
                </Link>
                
                <Link
                  to="/tags"
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                >
                  <Tag className="h-4 w-4" />
                  <span>Tags</span>
                </Link>
                
                <Link
                  to="/batch"
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                >
                  <Zap className="h-4 w-4" />
                  <span>Batch</span>
                </Link>
                
                <Link
                  to="/workflow"
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4" />
                  <span>Pro Workflow</span>
                </Link>
                
                <Link
                  to="/settings"
                  className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 px-4">
          <Routes>
            <Route path="/" element={<ImageGallery />} />
            <Route path="/upload" element={<ImageUpload />} />
            <Route path="/image/:id" element={<ImageEditor />} />
            <Route path="/tags" element={<TagManager />} />
            <Route path="/batch" element={<BatchProcessing />} />
            <Route path="/workflow" element={<ProfessionalWorkflow />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* Toast Notifications */}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </Router>
  );
}

export default App; 