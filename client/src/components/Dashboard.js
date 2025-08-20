import React, { useState, useEffect } from 'react';
import { Database, Tags, Folder, Settings, Eye, Edit3, FileText, Layers } from 'lucide-react';
import { useMode } from '../context/ModeContext';

const Dashboard = () => {
  const { canEdit } = useMode();
  const [activeSection, setActiveSection] = useState('tags');

  const sections = [
    { id: 'tags', label: 'Tags Database', icon: Tags, description: 'Manage all tags and categories' },
    { id: 'projects', label: 'Project Names', icon: Folder, description: 'Add/edit/delete project names' },
    { id: 'categories', label: 'Categories', icon: Layers, description: 'Manage image categories' },
    { id: 'policies', label: 'Image Policies', icon: FileText, description: 'View tagging and categorization rules' },
  ];

  // Only show server settings in edit mode
  if (canEdit) {
    sections.push({
      id: 'server', 
      label: 'Server Settings', 
      icon: Settings, 
      description: 'Folder structure and filing logic'
    });
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Central hub for image management and tagging system</p>
          </div>
          
          {/* Mode Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            {canEdit ? (
              <>
                <Edit3 className="h-3 w-3" />
                <span>Edit Mode</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                <span>View Mode</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeSection === section.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Section Description */}
        <div className="mt-4">
          <p className="text-gray-600">
            {sections.find(s => s.id === activeSection)?.description}
          </p>
        </div>
      </div>

      {/* Section Content */}
      <div>
        {activeSection === 'tags' && (
          <div>
            <div className="text-center py-12 bg-white">
              <Tags className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tags Database</h3>
              <p className="text-gray-600 mb-2">Tags management interface coming soon...</p>
              <p className="text-sm text-gray-500">
                View all existing tags, edit individual tags, and add new ones. 
                Hyperlinked to replace current Tags page functionality.
              </p>
            </div>
          </div>
        )}

        {activeSection === 'projects' && (
          <div>
            <div className="text-center py-12 bg-white">
              <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Project Names</h3>
              <p className="text-gray-600 mb-2">Project management interface coming soon...</p>
              <p className="text-sm text-gray-500">
                Add, edit, and delete project names. Manage both current and complete projects.
              </p>
            </div>
          </div>
        )}

        {activeSection === 'categories' && (
          <div>
            <div className="text-center py-12 bg-white">
              <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Categories</h3>
              <p className="text-gray-600 mb-2">Categories management interface coming soon...</p>
              <p className="text-sm text-gray-500">
                Manage image categories like exteriors, interiors, kitchens, bathrooms, etc.
              </p>
            </div>
          </div>
        )}

        {activeSection === 'policies' && (
          <div>
            <div className="text-center py-12 bg-white">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Image Policies</h3>
              <p className="text-gray-600 mb-2">Image policies and tagging rules interface coming soon...</p>
              <p className="text-sm text-gray-500">
                View how images are defined, tagging policies, and categorization rules.
                Available in both view and edit modes.
              </p>
            </div>
          </div>
        )}

        {activeSection === 'server' && canEdit && (
          <div>
            <div className="text-center py-12 bg-white">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Server Settings</h3>
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mb-2">
                Edit Mode Only
              </div>
              <p className="text-gray-600 mb-2">Server settings and folder structure management.</p>
              <p className="text-sm text-gray-500">
                Configure Dropbox folder structure, filing logic, and server-side rules.
                Will incorporate current Settings page functionality.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
