import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { Search, Upload, Tag, Settings as SettingsIcon, FileText, FolderOpen, Eye, Edit3 } from 'lucide-react';

import { ModeProvider, useMode } from './context/ModeContext';

import ImageGallery from './components/ImageGallery';
import ImageUpload from './components/ImageUpload';
import ImageEditor from './components/ImageEditor';
import TagManager from './components/TagManager';
import Settings from './components/Settings';
import ProfessionalWorkflow from './components/ProfessionalWorkflow';
import Projects from './components/Projects';
import Dashboard from './components/Dashboard';

import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Navigation component that uses mode context
function Navigation() {
  const { isEditMode, toggleEditMode, formatTimeRemaining, canUpload, canAccessProWorkflow, canAccessSettings } = useMode();

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <img 
                src="/snaptag_logo_vector.png" 
                alt="SnapTag Logo" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-gray-900">SnapTag</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Mode Indicator & Toggle */}
            <div className="flex items-center space-x-2">
              <div
                className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium cursor-default ${
                  isEditMode 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
                title={`Mode toggle: Press ESC then E`}
              >
                {isEditMode ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                <span>{isEditMode ? 'Edit Mode' : 'View Mode'}</span>
                {isEditMode && formatTimeRemaining() && (
                  <span className="text-green-600 ml-1">({formatTimeRemaining()})</span>
                )}
              </div>
            </div>

            <Link
              to="/"
              className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
            >
              <Search className="h-4 w-4" />
              <span>Gallery</span>
            </Link>
            
            {canUpload && (
              <Link
                to="/upload"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </Link>
            )}
            
            <Link
              to="/tags"
              className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
            >
              <Tag className="h-4 w-4" />
              <span>Tags</span>
            </Link>
            
            {canAccessProWorkflow && (
              <Link
                to="/workflow"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              >
                <FileText className="h-4 w-4" />
                <span>Pro Workflow</span>
              </Link>
            )}
            
            <Link
              to="/projects"
              className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Projects</span>
            </Link>
            
            {canAccessSettings && (
              <Link
                to="/settings"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              >
                <SettingsIcon className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const { canUpload, canAccessProWorkflow, canAccessSettings } = useMode();

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4">
        <Routes>
          <Route path="/" element={<ImageGallery />} />
          {canUpload && <Route path="/upload" element={<ImageUpload />} />}
          <Route path="/image/:id" element={<ImageEditor />} />
          <Route path="/tags" element={<TagManager />} />
          {canAccessProWorkflow && <Route path="/workflow" element={<ProfessionalWorkflow />} />}
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/complete" element={<Projects />} />
          <Route path="/projects/current" element={<Projects />} />
          <Route path="/projects/complete/:projectId" element={<Projects />} />
          <Route path="/projects/complete/:projectId/:tabId" element={<Projects />} />
          <Route path="/projects/current/:projectId" element={<Projects />} />
          <Route path="/projects/current/:projectId/:tabId" element={<Projects />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {canAccessSettings && <Route path="/settings" element={<Settings />} />}
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
  );
}

function App() {
  return (
    <ModeProvider>
      <Router>
        <AppContent />
      </Router>
    </ModeProvider>
  );
}

export default App;