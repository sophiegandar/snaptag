import React, { useState, useEffect } from 'react';
import { Database, Tags, Folder, Settings, Eye, Edit3, FileText, Layers, Save, TestTube, Check, AlertCircle, RefreshCw, Droplets, Copy, Search, Plus, Trash2, Calendar, X, BarChart3, Box } from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { toast } from 'react-toastify';
import { apiCall } from '../utils/apiConfig';

// Inline editing components
const EditCategoryFormInline = ({ category, onSave, onCancel, types }) => {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description);
  const [type, setType] = useState(category.type || '');

  const handleSave = () => {
    if (name.trim() && type) {
      onSave(category.id, name, description, type);
    }
  };

  return (
    <div className="flex-1 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Category name"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Description"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select Type</option>
          {types.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

const EditTypeFormInline = ({ type, onSave, onCancel }) => {
  const [name, setName] = useState(type.name);
  const [description, setDescription] = useState(type.description);

  const handleSave = () => {
    if (name.trim()) {
      onSave(type.id, name, description);
    }
  };

  return (
    <div className="flex-1 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Type name"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Description"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

const EditProjectFormInline = ({ project, onSave, onCancel }) => {
  const [name, setName] = useState(project.name);

  const handleSave = () => {
    if (name.trim()) {
      onSave(project.id, name);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="flex-1 flex items-center gap-3">
      <Folder className="h-5 w-5 text-blue-500" />
      <div className="flex-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-medium"
          placeholder="Project name"
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

const EditTagFormInline = ({ tag, onSave, onCancel }) => {
  const [name, setName] = useState(tag.name);

  const handleSave = () => {
    if (name.trim()) {
      onSave(tag.id, name);
    }
  };

  return (
    <div className="flex-1 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Tag name"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1 text-white rounded text-sm hover:opacity-90"
          style={{backgroundColor: '#C9D468'}}
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-white rounded text-sm hover:opacity-90"
          style={{backgroundColor: '#BDAE93'}}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { canEdit } = useMode();
  const [activeSection, setActiveSection] = useState('tags');

  // Projects state
  const [currentProjects, setCurrentProjects] = useState([]);
  const [completeProjects, setCompleteProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');

  // Categories state
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingType, setEditingType] = useState(null);

  // Project editing state
  const [editingProject, setEditingProject] = useState(null);

  // Tags state
  const [tags, setTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Typo scan state
  const [typoScanning, setTypoScanning] = useState(false);
  const [typoSuggestions, setTypoSuggestions] = useState([]);
  const [showTypoResults, setShowTypoResults] = useState(false);

  // Pro Workflow state
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState({
    archicadReady: 0,
    indesignReady: 0,
    total: 0,
    archicadIssues: [],
    indesignIssues: [],
    lastScan: null
  });

  // Projects functions
  const loadCurrentProjects = () => {
    try {
      const stored = localStorage.getItem('snaptag-current-projects');
      if (stored) {
        const projects = JSON.parse(stored);
        setCurrentProjects(Array.isArray(projects) ? projects : []);
      }
    } catch (error) {
      console.error('Error loading current projects:', error);
      setCurrentProjects([]);
    }
  };

  const loadCompleteProjects = () => {
    // Load hardcoded complete projects (matching Projects.js)
    const defaultCompleteProjects = [
      {
        id: 'yandoit',
        name: 'Yandoit',
        tags: ['archier', 'yandoit', 'complete'],
        type: 'complete'
      }
    ];
    setCompleteProjects(defaultCompleteProjects);
  };

  // Categories functions
  const loadCategories = () => {
    try {
      // Force reset categories to ensure correct Dropbox folder structure categories
      localStorage.removeItem('snaptag-categories');
      localStorage.removeItem('snaptag-types');
      
      const storedCategories = localStorage.getItem('snaptag-categories');
      const storedTypes = localStorage.getItem('snaptag-types');
      
      if (storedCategories) {
        const parsed = JSON.parse(storedCategories);
        setCategories(Array.isArray(parsed) ? parsed : []);
      } else {
        // Default categories with their assigned types (ONLY 3 TYPES: archier, texture, precedent)
        const defaultCategories = [
          // Precedent categories (15 total)
          { id: 'art', name: 'Art', description: 'Artwork and artistic references', type: 'precedent' },
          { id: 'bathrooms', name: 'Bathrooms', description: 'Bathroom spaces and fixtures', type: 'precedent' },
          { id: 'details', name: 'Details', description: 'Architectural details and elements', type: 'precedent' },
          { id: 'doors', name: 'Doors', description: 'Door designs and hardware', type: 'precedent' },
          { id: 'exteriors', name: 'Exteriors', description: 'Building exterior views and facades', type: 'precedent' },
          { id: 'furniture', name: 'Furniture', description: 'Furniture design and arrangements', type: 'precedent' },
          { id: 'general', name: 'General', description: 'General or uncategorized images', type: 'precedent' },
          { id: 'interiors', name: 'Interiors', description: 'Interior spaces and rooms', type: 'precedent' },
          { id: 'joinery', name: 'Joinery', description: 'Custom joinery and built-in furniture', type: 'precedent' },
          { id: 'kitchens', name: 'Kitchens', description: 'Kitchen spaces and design', type: 'precedent' },
          { id: 'landscape', name: 'Landscape', description: 'Landscape and garden design', type: 'precedent' },
          { id: 'lighting', name: 'Lighting', description: 'Lighting design and fixtures', type: 'precedent' },
          { id: 'spatial', name: 'Spatial', description: 'Spatial arrangements and layouts', type: 'precedent' },
          { id: 'stairs', name: 'Stairs', description: 'Staircase design and details', type: 'precedent' },
          { id: 'structure', name: 'Structure', description: 'Structural elements and systems', type: 'precedent' },
          
          // Texture categories (10 total)
          { id: 'brick', name: 'Brick', description: 'Brick materials and patterns', type: 'texture' },
          { id: 'carpet', name: 'Carpet', description: 'Carpet and soft flooring materials', type: 'texture' },
          { id: 'concrete', name: 'Concrete', description: 'Concrete finishes and textures', type: 'texture' },
          { id: 'fabric', name: 'Fabric', description: 'Fabric and textile materials', type: 'texture' },
          { id: 'general', name: 'General', description: 'General texture materials', type: 'texture' },
          { id: 'landscape', name: 'Landscape', description: 'Landscape materials and textures', type: 'texture' },
          { id: 'metal', name: 'Metal', description: 'Metal materials and finishes', type: 'texture' },
          { id: 'stone', name: 'Stone', description: 'Stone materials and textures', type: 'texture' },
          { id: 'tile', name: 'Tile', description: 'Tile materials and patterns', type: 'texture' },
          { id: 'wood', name: 'Wood', description: 'Wood materials and finishes', type: 'texture' }
        ];
        setCategories(defaultCategories);
        localStorage.setItem('snaptag-categories', JSON.stringify(defaultCategories));
      }

      if (storedTypes) {
        const parsed = JSON.parse(storedTypes);
        setTypes(Array.isArray(parsed) ? parsed : []);
      } else {
        // Default types (main folder structure)
        const defaultTypes = [
          { id: 'archier', name: 'Archier', description: 'Team project images organised by project name' },
          { id: 'texture', name: 'Texture', description: 'Material samples organised by material type' },
          { id: 'precedent', name: 'Precedent', description: 'Reference images organised by category' }
        ];
        setTypes(defaultTypes);
        localStorage.setItem('snaptag-types', JSON.stringify(defaultTypes));
      }
    } catch (error) {
      console.error('Error loading categories/types:', error);
      setCategories([]);
      setTypes([]);
    }
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    if (!newCategoryType) {
      toast.error('Please select a type for this category');
      return;
    }

    if (!canEdit) {
      toast.error('Category creation is only available in edit mode');
      return;
    }

    const id = newCategoryName.toLowerCase().replace(/\s+/g, '-');
    const existing = categories.find(c => c.id === id);
    
    if (existing) {
      toast.error('A category with this name already exists');
      return;
    }

    const newCategory = {
      id,
      name: newCategoryName.trim(),
      description: `${newCategoryName.trim()} category`,
      type: newCategoryType
    };

    const updatedCategories = [...categories, newCategory];
    setCategories(updatedCategories);
    localStorage.setItem('snaptag-categories', JSON.stringify(updatedCategories));
    setNewCategoryName('');
    setNewCategoryType('');
    toast.success(`Category "${newCategory.name}" added to ${newCategoryType} type`);
  };

  const addType = () => {
    if (!newTypeName.trim()) {
      toast.error('Please enter a type name');
      return;
    }

    if (!canEdit) {
      toast.error('Type creation is only available in edit mode');
      return;
    }

    const id = newTypeName.toLowerCase().replace(/\s+/g, '-');
    const existing = types.find(t => t.id === id);
    
    if (existing) {
      toast.error('A type with this name already exists');
      return;
    }

    const newType = {
      id,
      name: newTypeName.trim(),
      description: `${newTypeName.trim()} type`
    };

    const updatedTypes = [...types, newType];
    setTypes(updatedTypes);
    localStorage.setItem('snaptag-types', JSON.stringify(updatedTypes));
    setNewTypeName('');
    toast.success(`Type "${newType.name}" added successfully`);
  };

  const updateCategory = (categoryId, newName, newDescription, newType) => {
    if (!canEdit) {
      toast.error('Category editing is only available in edit mode');
      return;
    }

    const updatedCategories = categories.map(cat => 
      cat.id === categoryId 
        ? { ...cat, name: newName.trim(), description: newDescription.trim(), type: newType }
        : cat
    );
    
    setCategories(updatedCategories);
    localStorage.setItem('snaptag-categories', JSON.stringify(updatedCategories));
    setEditingCategory(null);
    toast.success('Category updated successfully');
  };

  const updateType = (typeId, newName, newDescription) => {
    if (!canEdit) {
      toast.error('Type editing is only available in edit mode');
      return;
    }

    const updatedTypes = types.map(type => 
      type.id === typeId 
        ? { ...type, name: newName.trim(), description: newDescription.trim() }
        : type
    );
    
    setTypes(updatedTypes);
    localStorage.setItem('snaptag-types', JSON.stringify(updatedTypes));
    setEditingType(null);
    toast.success('Type updated successfully');
  };

  const deleteCategory = (categoryId) => {
    if (!canEdit) {
      toast.error('Category deletion is only available in edit mode');
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!window.confirm(`Are you sure you want to delete the "${category?.name}" category? This action cannot be undone.`)) {
      return;
    }

    const updatedCategories = categories.filter(c => c.id !== categoryId);
    setCategories(updatedCategories);
    localStorage.setItem('snaptag-categories', JSON.stringify(updatedCategories));
    
    toast.success(`Category "${category?.name}" deleted successfully`);
  };

  const deleteType = (typeId) => {
    if (!canEdit) {
      toast.error('Type deletion is only available in edit mode');
      return;
    }

    const type = types.find(t => t.id === typeId);
    if (!window.confirm(`Are you sure you want to delete the "${type?.name}" type? This action cannot be undone and will affect all categories using this type.`)) {
      return;
    }

    const updatedTypes = types.filter(t => t.id !== typeId);
    setTypes(updatedTypes);
    localStorage.setItem('snaptag-types', JSON.stringify(updatedTypes));
    
    toast.success(`Type "${type?.name}" deleted successfully`);
  };

  // Pro Workflow functions
  const scanImages = async () => {
    if (!canEdit) {
      toast.error('Image scanning is only available in edit mode');
      return;
    }

    try {
      setScanning(true);
      toast.info('Starting image compatibility scan...');

      // Fetch all images
      const response = await fetch('/api/images');
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }

      const images = await response.json();
      let archicadReady = 0;
      let indesignReady = 0;
      const archicadIssues = [];
      const indesignIssues = [];

      // Detailed compatibility analysis
      for (const image of images) {
        const filename = image.filename || '';
        
        // ArchiCAD compatibility analysis
        let archicadCompatible = true;
        const archicadReasons = [];
        
        // Check for low resolution indicators
        if (filename.includes('thumb') || filename.includes('low') || filename.includes('preview')) {
          archicadCompatible = false;
          archicadReasons.push('Appears to be low resolution/thumbnail');
        }
        
        // Check for unsupported formats for 3D mapping
        if (filename.endsWith('.gif') || filename.endsWith('.webp')) {
          archicadCompatible = false;
          archicadReasons.push('Unsupported format for 3D texture mapping');
        }
        
        // Check for very small file sizes that might indicate poor quality
        if (filename.includes('icon') || filename.includes('favicon')) {
          archicadCompatible = false;
          archicadReasons.push('Icon or favicon, not suitable for 3D modeling');
        }

        if (archicadCompatible) {
          archicadReady++;
        } else if (archicadIssues.length < 10) { // Limit to first 10 issues
          archicadIssues.push({
            filename: filename,
            reason: archicadReasons.join(', ')
          });
        }

        // InDesign compatibility analysis
        let indesignCompatible = true;
        const indesignReasons = [];
        
        // Check for print-ready formats
        if (!filename.endsWith('.jpg') && !filename.endsWith('.jpeg') && 
            !filename.endsWith('.png') && !filename.endsWith('.tiff') && 
            !filename.endsWith('.eps') && !filename.endsWith('.psd')) {
          indesignCompatible = false;
          indesignReasons.push('Unsupported format for print workflow');
        }
        
        // Check for web-only formats
        if (filename.endsWith('.gif') || filename.endsWith('.webp')) {
          indesignCompatible = false;
          indesignReasons.push('Web-only format, not suitable for print');
        }
        
        // Check for potential low resolution
        if (filename.includes('thumb') || filename.includes('low') || filename.includes('72dpi')) {
          indesignCompatible = false;
          indesignReasons.push('Likely below 300 DPI print requirement');
        }

        if (indesignCompatible) {
          indesignReady++;
        } else if (indesignIssues.length < 10) { // Limit to first 10 issues
          indesignIssues.push({
            filename: filename,
            reason: indesignReasons.join(', ')
          });
        }
      }

      setScanResults({
        archicadReady,
        indesignReady,
        total: images.length,
        archicadIssues,
        indesignIssues,
        lastScan: new Date().toLocaleString()
      });

      toast.success(`Scan complete! Found ${archicadReady} ArchiCAD-ready and ${indesignReady} InDesign-ready images.`);
    } catch (error) {
      console.error('Error scanning images:', error);
      toast.error('Failed to scan images');
    } finally {
      setScanning(false);
    }
  };

  const createNewProject = () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    if (!canEdit) {
      toast.error('Project creation is only available in edit mode');
      return;
    }

    try {
      const existing = currentProjects.find(p => 
        p.name.toLowerCase() === newProjectName.trim().toLowerCase()
      );
      
      if (existing) {
        toast.error('A project with this name already exists');
        return;
      }

      const newProject = {
        id: newProjectName.toLowerCase().replace(/\s+/g, '-'),
        name: newProjectName.trim(),
        tags: [newProjectName.toLowerCase().replace(/\s+/g, ' ')],
        type: 'current',
        created: new Date().toISOString()
      };

      const updatedProjects = [...currentProjects, newProject];
      setCurrentProjects(updatedProjects);
      localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedProjects));
      
      setNewProjectName('');
      toast.success(`Project "${newProject.name}" created successfully`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    }
  };

  const deleteProject = (projectId) => {
    if (!canEdit) {
      toast.error('Project deletion is only available in edit mode');
      return;
    }

    try {
      const updatedProjects = currentProjects.filter(p => p.id !== projectId);
      setCurrentProjects(updatedProjects);
      localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedProjects));
      
      const deletedProject = currentProjects.find(p => p.id === projectId);
      toast.success(`Project "${deletedProject?.name}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const updateProject = (projectId, newName) => {
    if (!canEdit) {
      toast.error('Project editing is only available in edit mode');
      return;
    }

    if (!newName.trim()) {
      toast.error('Project name cannot be empty');
      return;
    }

    try {
      // Check if another project already has this name
      const existing = currentProjects.find(p => 
        p.id !== projectId && p.name.toLowerCase() === newName.trim().toLowerCase()
      );
      
      if (existing) {
        toast.error('A project with this name already exists');
        return;
      }

      const updatedProjects = currentProjects.map(project => 
        project.id === projectId 
          ? { ...project, name: newName.trim(), tags: [newName.toLowerCase().replace(/\s+/g, ' ')] }
          : project
      );
      
      setCurrentProjects(updatedProjects);
      localStorage.setItem('snaptag-current-projects', JSON.stringify(updatedProjects));
      setEditingProject(null);
      toast.success('Project name updated successfully');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    }
  };

  // Tags functions
  const loadTags = async () => {
    try {
      setTagsLoading(true);
      const response = await apiCall('/api/tags');
      if (!response.ok) throw new Error('Failed to load tags');
      
      const data = await response.json();
      // Sort tags alphabetically by name
      const sortedTags = data.sort((a, b) => a.name.localeCompare(b.name));
      setTags(sortedTags);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setTagsLoading(false);
    }
  };

  const addTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    if (!canEdit) {
      toast.error('Tag creation is only available in edit mode');
      return;
    }

    try {
      const response = await apiCall('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (response.status === 409) {
        toast.error('A tag with this name already exists');
        return;
      }

      if (!response.ok) throw new Error('Failed to create tag');

      const newTag = await response.json();
      setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
      toast.success('Tag added successfully');
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Failed to add tag');
    }
  };

  const updateTag = async (tagId, newName) => {
    if (!canEdit) {
      toast.error('Tag editing is only available in edit mode');
      return;
    }

    if (!newName.trim()) {
      toast.error('Tag name cannot be empty');
      return;
    }

    const normalizedNewName = newName.trim().toLowerCase();
    const currentTag = tags.find(t => t.id === tagId);
    
    if (!currentTag) {
      toast.error('Tag not found');
      return;
    }

    // Check if we're trying to rename to an existing tag
    const existingTag = tags.find(t => t.name.toLowerCase() === normalizedNewName && t.id !== tagId);
    
    if (existingTag) {
      // Offer to merge the tags
      const confirmed = window.confirm(
        `A tag named "${existingTag.name}" already exists.\n\n` +
        `Would you like to MERGE "${currentTag.name}" into "${existingTag.name}"?\n\n` +
        `This will:\n` +
        `• Move all ${currentTag.usage_count || 0} images from "${currentTag.name}" to "${existingTag.name}"\n` +
        `• Delete the "${currentTag.name}" tag\n` +
        `• Keep the "${existingTag.name}" tag\n\n` +
        `Click OK to merge, or Cancel to choose a different name.`
      );
      
      if (!confirmed) {
        return; // User cancelled, stay in edit mode
      }
      
      // User confirmed, proceed with merge
      try {
        const response = await apiCall('/api/tags/merge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            sourceTagId: tagId, 
            targetTagId: existingTag.id 
          }),
        });

        if (!response.ok) throw new Error('Failed to merge tags');

        const result = await response.json();
        
        // Remove the source tag from local state and update target tag usage count
        setTags(prev => {
          const filtered = prev.filter(t => t.id !== tagId);
          return filtered.map(t => 
            t.id === existingTag.id 
              ? { ...t, usage_count: (t.usage_count || 0) + (currentTag.usage_count || 0) }
              : t
          ).sort((a, b) => a.name.localeCompare(b.name));
        });
        
        setEditingTag(null);
        toast.success(
          `Successfully merged "${currentTag.name}" into "${existingTag.name}". ` +
          `${result.mergedImageCount} images updated.`
        );
        
      } catch (error) {
        console.error('Error merging tags:', error);
        toast.error('Failed to merge tags');
      }
      
      return;
    }

    // No existing tag found, proceed with normal rename
    try {
      const response = await apiCall(`/api/tags/${tagId}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newName: normalizedNewName }),
      });

      if (response.status === 409) {
        toast.error('A tag with this name already exists');
        return;
      }

      if (!response.ok) throw new Error('Failed to update tag');

      // Update the tag in the local state
      setTags(prev => 
        prev.map(tag => 
          tag.id === tagId ? { ...tag, name: normalizedNewName } : tag
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingTag(null);
      toast.success('Tag updated successfully');
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error('Failed to update tag');
    }
  };

  const deleteTag = async (tagId) => {
    if (!canEdit) {
      toast.error('Tag deletion is only available in edit mode');
      return;
    }

    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the tag "${tag.name}"? This will remove it from all ${tag.usage_count || 0} images that use it.`
    );
    
    if (!confirmed) return;

    try {
      const response = await apiCall(`/api/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete tag');

      setTags(prev => prev.filter(t => t.id !== tagId));
      toast.success('Tag deleted successfully');
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Failed to delete tag');
    }
  };

  // Typo detection functions
  const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len2][len1];
  };

  const calculateSimilarity = (str1, str2) => {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    const distance = levenshteinDistance(str1, str2);
    return (maxLen - distance) / maxLen;
  };

  const scanForTypos = () => {
    if (!canEdit) {
      toast.error('Typo scanning is only available in edit mode');
      return;
    }

    setTypoScanning(true);
    setTypoSuggestions([]);
    setShowTypoResults(false);

    try {
      const suggestions = [];
      const processed = new Set();

      // Compare each tag with every other tag
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const tag1 = tags[i];
          const tag2 = tags[j];
          
          // Skip if we've already processed this pair
          const pairKey = `${Math.min(tag1.id, tag2.id)}-${Math.max(tag1.id, tag2.id)}`;
          if (processed.has(pairKey)) continue;
          processed.add(pairKey);

          const similarity = calculateSimilarity(tag1.name.toLowerCase(), tag2.name.toLowerCase());
          
          // Consider it a potential typo if:
          // 1. Similarity is between 0.6 and 0.95 (similar but not identical)
          // 2. Length difference is small (within 3 characters)
          // 3. At least one tag has some usage
          const lengthDiff = Math.abs(tag1.name.length - tag2.name.length);
          const hasUsage = (tag1.usage_count || 0) > 0 || (tag2.usage_count || 0) > 0;
          
          if (similarity >= 0.6 && similarity < 0.95 && lengthDiff <= 3 && hasUsage) {
            // Suggest merging the tag with lower usage into the one with higher usage
            const sourceTag = (tag1.usage_count || 0) <= (tag2.usage_count || 0) ? tag1 : tag2;
            const targetTag = (tag1.usage_count || 0) > (tag2.usage_count || 0) ? tag1 : tag2;
            
            suggestions.push({
              sourceTag,
              targetTag,
              similarity: Math.round(similarity * 100),
              reason: similarity >= 0.8 ? 'Very similar' : 'Potentially similar'
            });
          }
        }
      }

      // Sort by similarity score (highest first)
      suggestions.sort((a, b) => b.similarity - a.similarity);

      setTypoSuggestions(suggestions);
      setShowTypoResults(true);
      
      if (suggestions.length === 0) {
        toast.success('No potential typos detected! All tags look good.');
      } else {
        toast.success(`Found ${suggestions.length} potential typo(s) to review.`);
      }
      
    } catch (error) {
      console.error('Error scanning for typos:', error);
      toast.error('Failed to scan for typos');
    } finally {
      setTypoScanning(false);
    }
  };

  const executeMergeFromTypoScan = async (sourceTag, targetTag) => {
    const confirmed = window.confirm(
      `Merge "${sourceTag.name}" into "${targetTag.name}"?\n\n` +
      `This will:\n` +
      `• Move all ${sourceTag.usage_count || 0} images from "${sourceTag.name}" to "${targetTag.name}"\n` +
      `• Delete the "${sourceTag.name}" tag\n` +
      `• Keep the "${targetTag.name}" tag\n\n` +
      `Click OK to merge, or Cancel to skip.`
    );
    
    if (!confirmed) return;

    try {
      const response = await apiCall('/api/tags/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sourceTagId: sourceTag.id, 
          targetTagId: targetTag.id 
        }),
      });

      if (!response.ok) throw new Error('Failed to merge tags');

      const result = await response.json();
      
      // Update local state
      setTags(prev => {
        const filtered = prev.filter(t => t.id !== sourceTag.id);
        return filtered.map(t => 
          t.id === targetTag.id 
            ? { ...t, usage_count: (t.usage_count || 0) + (sourceTag.usage_count || 0) }
            : t
        ).sort((a, b) => a.name.localeCompare(b.name));
      });
      
      // Remove this suggestion from the list
      setTypoSuggestions(prev => 
        prev.filter(s => s.sourceTag.id !== sourceTag.id && s.targetTag.id !== sourceTag.id)
      );
      
      toast.success(
        `Successfully merged "${sourceTag.name}" into "${targetTag.name}". ` +
        `${result.mergedImageCount} images updated.`
      );
      
    } catch (error) {
      console.error('Error merging tags:', error);
      toast.error('Failed to merge tags');
    }
  };

  // Settings state (moved from Settings.js)
  const [settings, setSettings] = useState({
    dropboxToken: '',
    serverUrl: window.location.origin,
    dropboxFolder: '/ARCHIER Team Folder/Support/Production/SnapTag',
    autoBackup: true,
    imageQuality: 85,
    maxFileSize: 10,
    defaultTags: '',
    autoTagging: false,
    metadataFormat: 'both'
  });

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [stats, setStats] = useState({});

  // Settings functions (moved from Settings.js)
  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      
      // Load settings from localStorage
      const saved = localStorage.getItem('snaptag-settings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }
      
      // Also load current server settings
      try {
        const serverUrl = settings.serverUrl || window.location.origin;
        const response = await fetch(`${serverUrl}/api/settings`);
        if (response.ok) {
          const serverSettings = await response.json();
          setSettings(prev => ({ ...prev, ...serverSettings }));
        }
      } catch (error) {
        console.log('Could not load server settings:', error);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Save to localStorage
      localStorage.setItem('snaptag-settings', JSON.stringify(settings));
      
      // Save to server
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings to server');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus(null);
      
      const response = await fetch('/api/test-dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: settings.dropboxToken,
          folder: settings.dropboxFolder
        })
      });
      
      const result = await response.json();
      setConnectionStatus(result);
      
      if (result.success) {
        toast.success('Dropbox connection successful!');
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus({ success: false, error: 'Network error' });
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    if (activeSection === 'settings' && canEdit) {
      loadSettings();
      loadStats();
    } else if (activeSection === 'projects') {
      loadCurrentProjects();
      loadCompleteProjects();
    } else if (activeSection === 'categories') {
      loadCategories();
    } else if (activeSection === 'tags') {
      loadTags();
    }
  }, [activeSection, canEdit]);

  const sections = [
    { id: 'tags', label: 'Tags Database', description: '' },
    { id: 'projects', label: 'Projects', description: '' },
    { id: 'categories', label: 'Categories', description: '' },
    { id: 'policies', label: 'Image Policies', description: '' },
    { id: 'workflow', label: 'Pro Workflow', description: '' },
  ];

  // Only show settings in edit mode
  if (canEdit) {
    sections.push({
      id: 'settings', 
      label: 'Settings', 
      description: ''
    });
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

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
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeSection === section.id
                      ? 'text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  style={activeSection === section.id ? {
                    borderBottomColor: '#C9D468',
                    color: '#4a5568'
                  } : {}}
                >
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
          <div className="space-y-6">
            {/* Tags Header */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Tags Database</h3>
              </div>

              {/* Add New Tag */}
              {canEdit && (
                <div className="mb-6">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Enter new tag name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    />
                    <button
                      onClick={addTag}
                      className="px-4 py-2 text-white rounded-md hover:opacity-90 flex items-center gap-2"
                      style={{backgroundColor: '#C9D468'}}
                    >
                      <Plus className="h-4 w-4" />
                      Add Tag
                    </button>
                  </div>
                </div>
              )}

              {/* Typo Scan */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">Typo Detection</h4>
                    <p className="text-sm text-gray-500">
                      Scan for similar tags that might be typos
                      {!canEdit && (
                        <span className="text-gray-400"> (Edit mode required)</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={scanForTypos}
                    disabled={!canEdit || typoScanning || tags.length < 2}
                    className="px-4 py-2 text-white rounded-md hover:opacity-90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{backgroundColor: '#BDAE93'}}
                  >
                      {typoScanning ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          Scan for Typos
                        </>
                      )}
                    </button>
                  </div>

                  {/* Typo Results */}
                  {showTypoResults && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      {typoSuggestions.length === 0 ? (
                        <div className="text-center py-4">
                          <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                          <p className="text-gray-600">No potential typos found!</p>
                          <p className="text-sm text-gray-500">All your tags look clean.</p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="font-medium text-gray-900">
                              Found {typoSuggestions.length} potential typo(s)
                            </h5>
                            <button
                              onClick={() => setShowTypoResults(false)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            {typoSuggestions.map((suggestion, index) => (
                              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="text-sm font-medium text-red-600">
                                        "{suggestion.sourceTag.name}"
                                      </span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-sm font-medium text-green-600">
                                        "{suggestion.targetTag.name}"
                                      </span>
                                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                        {suggestion.similarity}% similar
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 space-x-4">
                                      <span>Source: {suggestion.sourceTag.usage_count || 0} images</span>
                                      <span>Target: {suggestion.targetTag.usage_count || 0} images</span>
                                      <span>{suggestion.reason}</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => executeMergeFromTypoScan(suggestion.sourceTag, suggestion.targetTag)}
                                      className="px-3 py-1 text-white rounded text-sm hover:opacity-90"
                                      style={{backgroundColor: '#C9D468'}}
                                      title="Merge tags"
                                    >
                                      Merge
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTypoSuggestions(prev => prev.filter((_, i) => i !== index));
                                      }}
                                      className="px-3 py-1 text-white rounded text-sm hover:opacity-90"
                                      style={{backgroundColor: '#BDAE93'}}
                                      title="Skip this suggestion"
                                    >
                                      Skip
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              {/* Tags List */}
              {tagsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading tags...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-4">
                    Total tags: {tags.length} | Showing all tags alphabetically
                  </p>
                  
                  {tags.length === 0 ? (
                    <div className="text-center py-8">
                      <Database className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No tags found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tags.map((tag) => (
                        <div key={tag.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          {editingTag === tag.id ? (
                            <EditTagFormInline 
                              tag={tag}
                              onSave={updateTag}
                              onCancel={() => setEditingTag(null)}
                            />
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-black">{tag.name}</span>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                    {tag.usage_count || 0} uses
                                  </span>
                                </div>
                                {tag.created_at && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Created: {new Date(tag.created_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              
                              {canEdit && (
                                <div className="flex gap-2 ml-3">
                                  <button
                                    onClick={() => setEditingTag(tag.id)}
                                    className="p-1 text-white rounded hover:opacity-90"
                                    style={{backgroundColor: '#C9D468'}}
                                    title="Edit tag"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => deleteTag(tag.id)}
                                    className="p-1 text-white rounded hover:opacity-90"
                                    style={{backgroundColor: '#BDAE93'}}
                                    title="Delete tag"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'projects' && (
          <div className="space-y-6">
            {/* Current Projects Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Current Projects</h3>
              </div>

              {/* New Project Form - Only show in edit mode */}
              {canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Create New Project</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Enter project name (e.g., 'Collins St')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && createNewProject()}
                    />
                    <button
                      onClick={createNewProject}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                      Create Project
                    </button>
                  </div>
                </div>
              )}

              {/* Current Projects List */}
              <div>
                {currentProjects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Folder className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No current projects found</p>
                    {canEdit && <p className="text-sm">Create your first project above</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {currentProjects.map((project) => (
                      <div
                        key={project.id}
                        className="p-3 bg-white border-2 border-black rounded-lg hover:bg-gray-50"
                      >
                        {editingProject === project.id ? (
                          <EditProjectFormInline
                            project={project}
                            onSave={updateProject}
                            onCancel={() => setEditingProject(null)}
                          />
                        ) : (
                          <>
                            <div className="text-center">
                              <h4 className="font-medium text-gray-900">{project.name}</h4>
                              <div className="text-xs text-gray-500 mt-1">
                                Created {new Date(project.created).toLocaleDateString()}
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex gap-2 justify-center mt-3">
                                <button
                                  onClick={() => setEditingProject(project.id)}
                                  className="p-2 rounded-md"
                                  style={{color: '#C9D468'}}
                                  title="Edit project name"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteProject(project.id)}
                                  className="p-2 rounded-md"
                                  style={{color: '#BDAE93'}}
                                  title="Delete project"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Complete Projects Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Complete Projects</h3>
              </div>
              
              {/* Complete Projects List */}
              <div className="mb-6">
                {completeProjects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Check className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No complete projects found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {completeProjects.map((project) => (
                      <div
                        key={project.id}
                        className="p-3 bg-white border-2 border-black rounded-lg hover:bg-gray-50"
                      >
                        <div className="text-center">
                          <h4 className="font-medium text-gray-900">{project.name}</h4>
                          <div className="text-sm text-gray-500 mt-1">
                            Complete Project
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Tags: {project.tags.join(', ')}
                          </div>
                        </div>
                        <div className="text-center mt-2">
                          <div className="text-sm font-medium" style={{color: '#C9D468'}}>
                            Complete
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Automatic Creation Info */}
              <div className="p-4 rounded-lg" style={{backgroundColor: '#BDAE93'}}>
                <h4 className="font-medium text-black mb-2">Automatic Project Creation</h4>
                <p className="text-black text-sm mb-3">
                  Complete projects are automatically created when images are tagged with:
                </p>
                <div className="space-y-1 text-sm text-black font-mono bg-black/10 p-3 rounded">
                  <div>• "archier" (team tag)</div>
                  <div>• "complete" (status tag)</div>
                  <div>• "[project name]" (specific project identifier)</div>
                </div>
                <p className="text-black text-sm mt-3">
                  These projects will automatically appear above and be organised in Dropbox under <code>/SnapTag/Archier/[Project]/</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'categories' && (
          <div className="space-y-6">
            {/* Types Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Dropbox Types (Main Folders)</h3>
                </div>
              </div>

              {/* Add New Type - Only show in edit mode */}
              {canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Add New Type</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="Enter type name (e.g., 'Materials')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addType()}
                    />
                    <button
                      onClick={addType}
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90"
                      style={{backgroundColor: '#C9D468'}}
                    >
                      <Plus className="h-4 w-4" />
                      Add Type
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Adding a new type will create a new main folder in the Dropbox structure.
                  </p>
                </div>
              )}

              {/* Types List */}
              <div>
                {types.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Folder className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No types found</p>
                    {canEdit && <p className="text-sm">Add your first type above</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {types.map((type) => (
                      <div
                        key={type.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        {editingType === type.id ? (
                          <EditTypeFormInline
                            type={type}
                            onSave={updateType}
                            onCancel={() => setEditingType(null)}
                          />
                        ) : (
                          <>
                            <div className="flex-1 text-center">
                              <h4 className="font-medium text-gray-900">{type.name}</h4>
                              <p className="text-sm text-gray-500">{type.description}</p>
                              <p className="text-xs text-black mt-1">
                                /SnapTag/{type.name}/
                              </p>
                            </div>
                            {canEdit && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingType(type.id)}
                                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-md"
                                  title="Edit type"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteType(type.id)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                                  title="Delete type"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Categories Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
                </div>
              </div>

              {/* Add New Category - Only show in edit mode */}
              {canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Add New Category</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name (e.g., 'Balconies', 'Glass')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select
                      value={newCategoryType}
                      onChange={(e) => setNewCategoryType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Type</option>
                      {types.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={addCategory}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                      Add Category
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Categories must be assigned to a type (Archier, Texture, or Precedent).
                  </p>
                </div>
              )}

              {/* Categories List */}
              <div>
                {categories.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Layers className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No categories found</p>
                    {canEdit && <p className="text-sm">Add your first category above</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Precedent Categories Column */}
                    <div>
                      <h4 className="text-lg font-medium mb-4 text-black">
                        Precedent Categories ({categories.filter(c => c.type === 'precedent').length})
                      </h4>
                      <div className="space-y-3">
                        {categories.filter(category => category.type === 'precedent').map((category) => {
                          const categoryType = types.find(t => t.id === category.type);
                          return (
                            <div
                              key={category.id}
                              className="flex items-center justify-between p-3 rounded-lg hover:opacity-80"
                              style={{backgroundColor: '#C9D468', borderColor: '#C9D468'}}
                            >
                              {editingCategory === category.id ? (
                                <EditCategoryFormInline
                                  category={category}
                                  types={types}
                                  onSave={updateCategory}
                                  onCancel={() => setEditingCategory(null)}
                                />
                              ) : (
                                <>
                                  <div className="flex items-center gap-3 flex-1">
                                    <div>
                                      <h5 className="font-medium text-gray-900">{category.name}</h5>
                                      <p className="text-xs mt-1 text-black">
                                        /SnapTag/Precedent/{category.name}/
                                      </p>
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => setEditingCategory(category.id)}
                                        className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                        title="Edit category"
                                      >
                                        <Edit3 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => deleteCategory(category.id)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        title="Delete category"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Texture Categories Column */}
                    <div>
                      <h4 className="text-lg font-medium mb-4 text-black">
                        Texture Categories ({categories.filter(c => c.type === 'texture').length})
                      </h4>
                      <div className="space-y-3">
                        {categories.filter(category => category.type === 'texture').map((category) => {
                          const categoryType = types.find(t => t.id === category.type);
                          return (
                            <div
                              key={category.id}
                              className="flex items-center justify-between p-3 rounded-lg hover:opacity-80"
                              style={{backgroundColor: '#BDAE93', borderColor: '#BDAE93'}}
                            >
                              {editingCategory === category.id ? (
                                <EditCategoryFormInline
                                  category={category}
                                  types={types}
                                  onSave={updateCategory}
                                  onCancel={() => setEditingCategory(null)}
                                />
                              ) : (
                                <>
                                  <div className="flex items-center gap-3 flex-1">
                                    <div>
                                      <h5 className="font-medium text-gray-900">{category.name}</h5>
                                      <p className="text-xs mt-1 text-black">
                                        /SnapTag/Texture/{category.name}/
                                      </p>
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => setEditingCategory(category.id)}
                                        className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                        title="Edit category"
                                      >
                                        <Edit3 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => deleteCategory(category.id)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        title="Delete category"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dropbox Integration Info */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Dropbox Folder Sync</h3>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Automatic Folder Creation</h4>
                <p className="text-blue-800 text-sm mb-3">
                  When you add new types or categories, the corresponding folder structure will be automatically created in Dropbox:
                </p>
                <div className="text-blue-800 text-sm space-y-2">
                  <div>• <strong>New Type:</strong> Creates /SnapTag/[TypeName]/ main folder</div>
                  <div>• <strong>New Category:</strong> Creates subfolders under all existing types</div>
                  <div>• <strong>Image Upload:</strong> Automatically sorted into correct folders based on tags</div>
                </div>
                <div className="mt-4 p-3 bg-blue-100 rounded text-blue-900 text-sm">
                  <strong>Example:</strong> Adding "Glass" category creates:
                  <div className="mt-1 font-mono text-xs">
                    /SnapTag/Precedent/Glass/<br/>
                    /SnapTag/Texture/Glass/<br/>
                    /SnapTag/Archier/[Project]/Glass/
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'policies' && (
          <div className="space-y-6">
            {/* Filename Format Policy */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Filename Format</h3>
              </div>
              
              <div className="p-4 rounded-lg mb-4" style={{backgroundColor: '#C9D468'}}>
                <h4 className="font-medium text-black mb-2">Standard Format:</h4>
                <div className="text-black font-mono text-sm bg-black/10 p-3 rounded">
                  AXXXX-type-category.jpg
                </div>
                <div className="text-black text-sm mt-2 space-y-1">
                  <div>• <strong>A</strong> = Alphabetical prefix</div>
                  <div>• <strong>XXXX</strong> = 4-digit sequential number</div>
                  <div>• <strong>type</strong> = precedent, texture, or project-specific</div>
                  <div>• <strong>category</strong> = exteriors, interiors, kitchens, bathrooms, stairs, etc.</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Example Precedent:</h5>
                  <code className="text-blue-600">A0124-precedent-exteriors.jpg</code>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Example Texture:</h5>
                  <code className="text-blue-600">A0168-texture-tile.jpg</code>
                </div>
              </div>
            </div>

            {/* Tagging Policies */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Tagging Policies</h3>
              </div>

              <div className="space-y-4">
                {/* Project Images */}
                <div className="pl-4">
                  <h4 className="font-medium text-gray-900 mb-2">Project Images</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div><strong>Required Tags:</strong> project name (e.g., "de witt st", "couvreur")</div>
                    <div><strong>Status Tags:</strong> "wip" (work in progress) or "final" (completed)</div>
                    <div><strong>Completion Tags:</strong> "complete" + "archier" (automatically creates complete project)</div>
                    <div><strong>Category Tags:</strong> exteriors, interiors, kitchens, bathrooms, stairs, etc.</div>
                  </div>
                </div>

                {/* Precedent Images */}
                <div className="pl-4">
                  <h4 className="font-medium text-gray-900 mb-2">Precedent Images</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div><strong>Required Tags:</strong> "precedent"</div>
                    <div><strong>Optional Project Tags:</strong> project name (for project-specific precedents)</div>
                    <div><strong>Category Tags:</strong> exteriors, interiors, general, stairs, etc.</div>
                    <div><strong>Usage:</strong> Reference images for design inspiration</div>
                  </div>
                </div>

                {/* Texture Images */}
                <div className="pl-4">
                  <h4 className="font-medium text-gray-900 mb-2">Texture Images</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div><strong>Required Tags:</strong> "texture"</div>
                    <div><strong>Optional Project Tags:</strong> project name (for project-specific materials)</div>
                    <div><strong>Material Tags:</strong> tile, wood, stone, brick, carpet, metal, etc.</div>
                    <div><strong>Usage:</strong> Material samples and texture references</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Folder Structure Policy */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Dropbox Organisation</h3>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Automatic Folder Structure:</h4>
                <div className="text-sm text-gray-700 space-y-2 font-mono">
                  <div className="pl-0">/SnapTag/</div>
                  <div className="pl-4">Archier/ <span className="text-gray-500">(team projects)</span></div>
                  <div className="pl-8">[Project Name]/ <span className="text-gray-500">(e.g., "De Witt St")</span></div>
                  <div className="pl-12">Final/ <span className="text-gray-500">(images tagged "final")</span></div>
                  <div className="pl-12">WIP/ <span className="text-gray-500">(images tagged "wip")</span></div>
                  <div className="pl-4">Precedent/ <span className="text-gray-500">(reference images)</span></div>
                  <div className="pl-8">[Category]/ <span className="text-gray-500">(exteriors, interiors, etc.)</span></div>
                  <div className="pl-4">Texture/ <span className="text-gray-500">(material images)</span></div>
                  <div className="pl-8">[Texture Type]/ <span className="text-gray-500">(tile, wood, stone, etc.)</span></div>
                </div>
              </div>
            </div>

            {/* Search and Filter Logic */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Search & Filter Logic</h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg" style={{backgroundColor: '#C9D468'}}>
                  <h4 className="font-medium text-black mb-2">AND Logic (All Required)</h4>
                  <p className="text-black text-sm mb-2">
                    Images must have ALL specified tags to appear in results:
                  </p>
                  <div className="text-black text-sm space-y-1">
                    <div>• Project tab: project name + tab type (e.g., "de witt st" + "precedent")</div>
                    <div>• Photos tab: project name + "complete" + filter ("final" or "wip")</div>
                    <div>• Texture tab: project name + "texture"</div>
                  </div>
                </div>

                <div className="p-4 rounded-lg" style={{backgroundColor: '#BDAE93'}}>
                  <h4 className="font-medium text-black mb-2">Project Tab Behavior</h4>
                  <div className="text-black text-sm space-y-1">
                    <div>• <strong>Current Projects:</strong> Precedent, Texture, Photos tabs</div>
                    <div>• <strong>Complete Projects:</strong> Final, WIP tabs (Photos tab with filters)</div>
                    <div>• <strong>Photos Tab:</strong> Only shows images with "complete" tag</div>
                    <div>• <strong>Filters:</strong> Final/WIP dropdown in Photos tab</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Lifecycle */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Project Lifecycle</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-gray-100 rounded-full p-2">
                    <span className="text-black font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Current Project Creation</h4>
                    <p className="text-gray-600 text-sm">Manual creation via Dashboard or Projects page</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-gray-100 rounded-full p-2">
                    <span className="text-black font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Image Collection</h4>
                    <p className="text-gray-600 text-sm">Add precedents, textures, and WIP images with project tags</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-gray-100 rounded-full p-2">
                    <span className="text-black font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Project Completion</h4>
                    <p className="text-gray-600 text-sm">Tag final images with "complete" + "archier" + project name</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-gray-100 rounded-full p-2">
                    <span className="text-black font-bold text-sm">4</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Automatic Migration</h4>
                    <p className="text-gray-600 text-sm">Project automatically appears in Complete section with Final/WIP tabs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'workflow' && (
          <div className="space-y-6">
            {/* Pro Workflow Header */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Pro Workflow</h3>
                  </div>

                </div>
                
                <button
                  onClick={scanImages}
                  disabled={scanning || !canEdit}
                  className="flex items-center gap-2 px-6 py-3 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{backgroundColor: '#C9D468'}}
                >
                  {scanning ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      Scan All Images
                    </>
                  )}
                </button>
              </div>
              


              {scanResults.lastScan && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-800">Last scan: {scanResults.lastScan}</span>
                    <span className="text-green-600">{scanResults.total} images scanned</span>
                  </div>
                </div>
              )}
            </div>

            {/* Three side-by-side containers */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* ArchiCAD Scanner */}
              <div className="p-6 rounded-lg border" style={{backgroundColor: '#C9D468', borderColor: '#C9D468'}}>
                <div className="mb-4">
                  <h4 className="font-medium text-black">ArchiCAD</h4>
                </div>
                
                <div className="text-sm text-black">
                  <p className="text-black mb-3">3D modeling & texture mapping</p>
                  
                  <ul className="space-y-1 text-black text-xs mb-4">
                    <li>• High resolution textures</li>
                    <li>• Seamless tiling patterns</li>
                    <li>• Material library ready</li>
                    <li>• Surface detail analysis</li>
                  </ul>

                  {scanResults.total > 0 && (
                    <div className="pt-3 border-t border-black/20">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-black">Ready:</span>
                        <span className="text-lg font-bold text-black">{scanResults.archicadReady}</span>
                      </div>
                    </div>
                  )}

                  {scanResults.archicadIssues && scanResults.archicadIssues.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/20">
                      <h5 className="font-medium text-black mb-2">Issues Found:</h5>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {scanResults.archicadIssues.map((issue, idx) => (
                          <div key={idx} className="text-xs text-black bg-black/10 p-2 rounded">
                            <div className="font-medium truncate">{issue.filename}</div>
                            <div className="text-black/70">{issue.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* InDesign Scanner */}
              <div className="p-6 rounded-lg border" style={{backgroundColor: '#BDAE93', borderColor: '#BDAE93'}}>
                <div className="mb-4">
                  <h4 className="font-medium text-black">InDesign</h4>
                </div>
                
                <div className="text-sm text-black">
                  <p className="text-black mb-3">Print & digital publication</p>
                  
                  <ul className="space-y-1 text-black text-xs mb-4">
                    <li>• 300+ DPI resolution</li>
                    <li>• CMYK color profile</li>
                    <li>• Print-ready formats</li>
                    <li>• Layout optimization</li>
                  </ul>

                  {scanResults.total > 0 && (
                    <div className="pt-3 border-t border-black/20">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-black">Ready:</span>
                        <span className="text-lg font-bold text-black">{scanResults.indesignReady}</span>
                      </div>
                    </div>
                  )}

                  {scanResults.indesignIssues && scanResults.indesignIssues.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/20">
                      <h5 className="font-medium text-black mb-2">Issues Found:</h5>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {scanResults.indesignIssues.map((issue, idx) => (
                          <div key={idx} className="text-xs text-black bg-black/10 p-2 rounded">
                            <div className="font-medium truncate">{issue.filename}</div>
                            <div className="text-black/70">{issue.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* General Analysis */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900">Analysis</h4>
                </div>
                
                <div className="text-sm text-gray-800">
                  <p className="text-gray-700 mb-3">Compatibility overview</p>
                  
                  {scanResults.total > 0 ? (
                    <div className="space-y-3 text-xs">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>ArchiCAD Ready:</span>
                          <span className="font-medium" style={{color: '#C9D468'}}>{scanResults.archicadReady}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>InDesign Ready:</span>
                          <span className="font-medium" style={{color: '#BDAE93'}}>{scanResults.indesignReady}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Scanned:</span>
                          <span className="font-medium">{scanResults.total}</span>
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex justify-between">
                          <span>Success Rate:</span>
                          <span className="font-medium" style={{color: '#C9D468'}}>
                            {Math.round(((scanResults.archicadReady + scanResults.indesignReady) / (scanResults.total * 2)) * 100)}%
                          </span>
                        </div>
                      </div>

                      {(scanResults.archicadIssues?.length > 0 || scanResults.indesignIssues?.length > 0) && (
                        <div className="pt-3 border-t border-gray-200">
                          <div className="text-gray-600">
                            <div>Issues: {(scanResults.archicadIssues?.length || 0) + (scanResults.indesignIssues?.length || 0)}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              See detailed issues in the software-specific panels
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      Run a scan to see compatibility analysis
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'settings' && canEdit && (
          <div className="space-y-6">
            {/* Settings Header */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                  <p className="text-gray-600">Configure Dropbox connection and server settings</p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSettings({
                        dropboxToken: '',
                        serverUrl: window.location.origin,
                        dropboxFolder: '/ARCHIER Team Folder/Support/Production/SnapTag',
                        autoBackup: true,
                        imageQuality: 85,
                        maxFileSize: 10,
                        defaultTags: '',
                        autoTagging: false,
                        metadataFormat: 'both'
                      });
                      toast.info('Settings reset to defaults');
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Reset to Defaults
                  </button>
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Connection Settings */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Connection Settings</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dropbox Access Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={settings.dropboxToken}
                      onChange={(e) => setSettings(prev => ({ ...prev, dropboxToken: e.target.value }))}
                      placeholder="Enter your Dropbox access token"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={testConnection}
                      disabled={testing || !settings.dropboxToken}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                    >
                      {testing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      Test
                    </button>
                  </div>
                  {connectionStatus && (
                    <div className={`mt-2 p-3 rounded-md flex items-center gap-2 ${
                      connectionStatus.success 
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {connectionStatus.success ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>
                        {connectionStatus.success 
                          ? 'Connection successful!' 
                          : `Error: ${connectionStatus.error}`
                        }
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dropbox Folder Path
                  </label>
                  <input
                    type="text"
                    value={settings.dropboxFolder}
                    onChange={(e) => setSettings(prev => ({ ...prev, dropboxFolder: e.target.value }))}
                    placeholder="/ARCHIER Team Folder/Support/Production/SnapTag"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Root folder where images will be stored in Dropbox
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            {stats.totalImages && (
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold">Database Statistics</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalImages}</div>
                    <div className="text-sm text-gray-600">Total Images</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.totalTags}</div>
                    <div className="text-sm text-gray-600">Total Tags</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.uniqueSources}</div>
                    <div className="text-sm text-gray-600">Unique Sources</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(stats.totalFileSize / (1024 * 1024))} MB
                    </div>
                    <div className="text-sm text-gray-600">Total Size</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
