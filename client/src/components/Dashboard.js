import React, { useState, useEffect } from 'react';
import { Database, Folder, Eye, Edit3, Save, TestTube, Check, AlertCircle, RefreshCw, Droplets, Search, Plus, Trash2, X, Box } from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { toast } from 'react-toastify';
import { apiCall } from '../utils/apiConfig';

// Utility function to capitalize text for display
const capitalizeForDisplay = (text) => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Inline editing components

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

const EditStageFormInline = ({ stage, onSave, onCancel }) => {
  const [name, setName] = useState(stage.name);
  const [description, setDescription] = useState(stage.description || '');

  const handleSave = () => {
    if (name.trim()) {
      onSave(stage.id, name, description);
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
    <div className="flex-1 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Stage name"
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Description (optional)"
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

const EditRoomFormInline = ({ room, onSave, onCancel }) => {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description || '');
  const [category, setCategory] = useState(room.category || '');

  const handleSave = () => {
    if (name.trim()) {
      onSave(room.id, name, description, category);
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
    <div className="flex-1 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Room name"
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Description (optional)"
        />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Category (optional)"
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



  // Project editing state
  const [editingProject, setEditingProject] = useState(null);

  // Tags state
  const [tags, setTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Stages state
  const [stages, setStages] = useState([]);
  const [newStageName, setNewStageName] = useState('');
  const [editingStage, setEditingStage] = useState(null);
  const [stagesLoading, setStagesLoading] = useState(false);

  // Rooms state
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomsLoading, setRoomsLoading] = useState(false);

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
  const loadCurrentProjects = async () => {
    try {
      console.log('🔄 Dashboard: Loading current projects from API...');
      const response = await fetch('/api/projects');
      if (response.ok) {
        const projects = await response.json();
        const current = projects.filter(p => p.status === 'current');
        setCurrentProjects(current);
        console.log(`📊 Dashboard: Current projects: ${current.length}`);
      } else {
        console.error('❌ Dashboard: Failed to load current projects from API');
        setCurrentProjects([]);
      }
    } catch (error) {
      console.error('❌ Dashboard: Error loading current projects:', error);
      setCurrentProjects([]);
    }
  };

  const loadCompleteProjects = async () => {
    try {
      console.log('🔄 Dashboard: Loading complete projects from API...');
      const response = await fetch('/api/projects');
      if (response.ok) {
        const projects = await response.json();
        console.log(`✅ Dashboard: Loaded ${projects.length} projects from API`);
        
        // Filter for complete projects only
        const complete = projects.filter(p => p.status === 'complete');
        setCompleteProjects(complete);
        console.log(`📊 Dashboard: Complete projects: ${complete.length}`);
      } else {
        console.error('❌ Dashboard: Failed to load projects from API, using fallback');
        // Fallback to hardcoded list
        const defaultCompleteProjects = [
          {
            id: 'yandoit',
            name: 'Yandoit',
            tags: ['archier', 'yandoit', 'complete'],
            type: 'complete'
          }
        ];
        setCompleteProjects(defaultCompleteProjects);
      }
    } catch (error) {
      console.error('❌ Dashboard: Error loading complete projects:', error);
      // Fallback to hardcoded list
      const defaultCompleteProjects = [
        {
          id: 'yandoit',
          name: 'Yandoit',
          tags: ['archier', 'yandoit', 'complete'],
          type: 'complete'
        }
      ];
      setCompleteProjects(defaultCompleteProjects);
    }
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

  // Stages functions
  const loadStages = async () => {
    try {
      setStagesLoading(true);
      const response = await apiCall('/api/stages');
      if (!response.ok) throw new Error('Failed to load stages');
      
      const data = await response.json();
      setStages(data);
    } catch (error) {
      console.error('Error loading stages:', error);
      toast.error('Failed to load stages');
    } finally {
      setStagesLoading(false);
    }
  };

  const addStage = async () => {
    if (!newStageName.trim()) {
      toast.error('Please enter a stage name');
      return;
    }

    if (!canEdit) {
      toast.error('Stage creation is only available in edit mode');
      return;
    }

    try {
      const response = await apiCall('/api/stages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newStageName.trim() }),
      });

      if (response.status === 409) {
        toast.error('A stage with this name already exists');
        return;
      }

      if (!response.ok) throw new Error('Failed to create stage');

      const newStage = await response.json();
      setStages(prev => [...prev, newStage].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStageName('');
      toast.success('Stage added successfully');
    } catch (error) {
      console.error('Error adding stage:', error);
      toast.error('Failed to add stage');
    }
  };

  const updateStage = async (stageId, newName, newDescription) => {
    if (!canEdit) {
      toast.error('Stage editing is only available in edit mode');
      return;
    }

    if (!newName.trim()) {
      toast.error('Stage name cannot be empty');
      return;
    }

    try {
      const response = await apiCall(`/api/stages/${stageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });

      if (response.status === 409) {
        toast.error('A stage with this name already exists');
        return;
      }

      if (!response.ok) throw new Error('Failed to update stage');

      const updatedStage = await response.json();
      setStages(prev => 
        prev.map(stage => 
          stage.id === stageId ? updatedStage : stage
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingStage(null);
      toast.success('Stage updated successfully');
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Failed to update stage');
    }
  };

  const deleteStage = async (stageId) => {
    if (!canEdit) {
      toast.error('Stage deletion is only available in edit mode');
      return;
    }

    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the stage "${stage.name}"?`
    );
    
    if (!confirmed) return;

    try {
      const response = await apiCall(`/api/stages/${stageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete stage');

      setStages(prev => prev.filter(s => s.id !== stageId));
      toast.success('Stage deleted successfully');
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast.error('Failed to delete stage');
    }
  };

  // Rooms functions
  const loadRooms = async () => {
    try {
      setRoomsLoading(true);
      const response = await apiCall('/api/rooms');
      if (!response.ok) throw new Error('Failed to load rooms');
      
      const data = await response.json();
      setRooms(data);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setRoomsLoading(false);
    }
  };

  const addRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error('Please enter a room name');
      return;
    }

    if (!canEdit) {
      toast.error('Room creation is only available in edit mode');
      return;
    }

    try {
      const response = await apiCall('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: newRoomName.trim()
        }),
      });

      if (response.status === 409) {
        toast.error('A room with this name already exists');
        return;
      }

      if (!response.ok) throw new Error('Failed to create room');

      const newRoom = await response.json();
      setRooms(prev => [...prev, newRoom].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRoomName('');
      toast.success('Room added successfully');
    } catch (error) {
      console.error('Error adding room:', error);
      toast.error('Failed to add room');
    }
  };

  const updateRoom = async (roomId, newName, newDescription, newCategory) => {
    if (!canEdit) {
      toast.error('Room editing is only available in edit mode');
      return;
    }

    if (!newName.trim()) {
      toast.error('Room name cannot be empty');
      return;
    }

    try {
      const response = await apiCall(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: newName.trim(), 
          description: newDescription.trim(),
          category: newCategory.trim()
        }),
      });

      if (response.status === 409) {
        toast.error('A room with this name already exists');
        return;
      }

      if (!response.ok) throw new Error('Failed to update room');

      const updatedRoom = await response.json();
      setRooms(prev => 
        prev.map(room => 
          room.id === roomId ? updatedRoom : room
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingRoom(null);
      toast.success('Room updated successfully');
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error('Failed to update room');
    }
  };

  const deleteRoom = async (roomId) => {
    if (!canEdit) {
      toast.error('Room deletion is only available in edit mode');
      return;
    }

    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the room "${room.name}"?`
    );
    
    if (!confirmed) return;

    try {
      const response = await apiCall(`/api/rooms/${roomId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete room');

      setRooms(prev => prev.filter(r => r.id !== roomId));
      toast.success('Room deleted successfully');
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('Failed to delete room');
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
      `Are you sure you want to delete the tag "${capitalizeForDisplay(tag.name)}"? This will remove it from all ${tag.usage_count || 0} images that use it.`
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
    } else if (activeSection === 'tags') {
      loadTags();
      loadStages();
      loadRooms();
    }
  }, [activeSection, canEdit, loadSettings, loadStats, loadCurrentProjects, loadCompleteProjects, loadTags, loadStages, loadRooms]);

  const sections = [
    { id: 'tags', label: 'Tags Database', description: '' },
    { id: 'projects', label: 'Projects', description: '' },
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
                                  <span className="font-medium text-black">{capitalizeForDisplay(tag.name)}</span>
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



            {/* Stages Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Project Stages</h3>
                  <p className="text-sm text-gray-500">Manage project workflow stages for filtering</p>
                </div>
              </div>

              {/* Add New Stage - Only show in edit mode */}
              {canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Add New Stage</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      placeholder="Stage name (e.g., 'Feasibility', 'Layout')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addStage()}
                    />
                    <button
                      onClick={addStage}
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90"
                      style={{backgroundColor: '#C9D468'}}
                    >
                      <Plus className="h-4 w-4" />
                      Add Stage
                    </button>
                  </div>
                </div>
              )}

              {/* Stages List */}
              {stagesLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading stages...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-4">
                    Total stages: {stages.length}
                  </p>
                  
                  {stages.length === 0 ? (
                    <div className="text-center py-8">
                      <Box className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No stages found</p>
                      {canEdit && <p className="text-sm text-gray-400">Add your first stage above</p>}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stages.map((stage) => (
                        <div key={stage.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          {editingStage === stage.id ? (
                            <EditStageFormInline 
                              stage={stage}
                              onSave={updateStage}
                              onCancel={() => setEditingStage(null)}
                            />
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-black">{stage.name}</span>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                    {stage.usage_count || 0} uses
                                  </span>
                                </div>
                                {stage.description && (
                                  <p className="text-xs text-gray-500 mt-1">{stage.description}</p>
                                )}
                                {stage.created_at && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Created: {new Date(stage.created_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              
                              {canEdit && (
                                <div className="flex gap-2 ml-3">
                                  <button
                                    onClick={() => setEditingStage(stage.id)}
                                    className="p-1 text-white rounded hover:opacity-90"
                                    style={{backgroundColor: '#C9D468'}}
                                    title="Edit stage"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => deleteStage(stage.id)}
                                    className="p-1 text-white rounded hover:opacity-90"
                                    style={{backgroundColor: '#BDAE93'}}
                                    title="Delete stage"
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

            {/* Rooms Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Room Types</h3>
                  <p className="text-sm text-gray-500">Manage room categories for filtering</p>
                </div>
              </div>

              {/* Add New Room - Only show in edit mode */}
              {canEdit && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Add New Room Type</h4>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="Room name (e.g., 'Living', 'Kitchen')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addRoom()}
                    />
                    <button
                      onClick={addRoom}
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-md hover:opacity-90"
                      style={{backgroundColor: '#C9D468'}}
                    >
                      <Plus className="h-4 w-4" />
                      Add Room
                    </button>
                  </div>
                </div>
              )}

              {/* Rooms List */}
              {roomsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Loading rooms...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-4">
                    Total rooms: {rooms.length}
                  </p>
                  
                  {rooms.length === 0 ? (
                    <div className="text-center py-8">
                      <Box className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No rooms found</p>
                      {canEdit && <p className="text-sm text-gray-400">Add your first room above</p>}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rooms.map((room) => (
                        <div key={room.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          {editingRoom === room.id ? (
                            <EditRoomFormInline 
                              room={room}
                              onSave={updateRoom}
                              onCancel={() => setEditingRoom(null)}
                            />
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-black">{room.name}</span>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                    {room.usage_count || 0} uses
                                  </span>
                                </div>
                                {room.description && (
                                  <p className="text-xs text-gray-500 mt-1">{room.description}</p>
                                )}
                                {room.category && (
                                  <p className="text-xs text-gray-500 mt-1">Category: {room.category}</p>
                                )}
                                {room.created_at && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Created: {new Date(room.created_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              
                              {canEdit && (
                                <div className="flex gap-2 ml-3">
                                  <button
                                    onClick={() => setEditingRoom(room.id)}
                                    className="p-1 text-white rounded hover:opacity-90"
                                    style={{backgroundColor: '#C9D468'}}
                                    title="Edit room"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => deleteRoom(room.id)}
                                    className="p-1 text-white rounded hover:opacity-90"
                                    style={{backgroundColor: '#BDAE93'}}
                                    title="Delete room"
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
                            Tags: {project.tags ? project.tags.join(', ') : `${project.team_tag || 'archier'}, ${project.status_tag || 'complete'}`}
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

            {/* Dropbox Organisation & Folder Management */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Dropbox Organisation</h3>
              </div>
              
              <div className="space-y-6">
                {/* Folder Structure */}
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

                {/* Automatic Folder Creation */}
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
