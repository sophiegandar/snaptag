import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fabric } from 'fabric';
import { Save, Tag, X, ArrowLeft, Trash2, Edit3, ChevronLeft, ChevronRight, Lightbulb, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import { useMode } from '../context/ModeContext';

// Utility function to capitalize text for display
const capitalizeForDisplay = (text) => {
  if (!text) return text;
  // Capitalize all words in multi-word tags/text
  return text.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

const ImageEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { canEdit } = useMode();
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const fallbackTimeoutRef = useRef(null);
  
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState([]);
  const [focusedTags, setFocusedTags] = useState([]);
  const [editableName, setEditableName] = useState('');
  const [isTaggingMode, setIsTaggingMode] = useState(false);
  const [newTag, setNewTag] = useState('');
  // Removed unused selectedRegion state
  const [canvasReady, setCanvasReady] = useState(false);
  const [pendingTagLocation, setPendingTagLocation] = useState(null);
  const [useFallbackMode, setUseFallbackMode] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState(null);
  const [resizing, setResizing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editingTagName, setEditingTagName] = useState(null);
  const [editingTagText, setEditingTagText] = useState('');
  
  // Project assignments state
  const [projectAssignments, setProjectAssignments] = useState([]);
  const [originalProjectAssignments, setOriginalProjectAssignments] = useState([]);
  
  // Available projects, rooms, stages for dropdowns
  const [, setAvailableRooms] = useState([]);
  const [, setAvailableStages] = useState([]);
  
  // Navigation state
  const [navigationContext, setNavigationContext] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalTags, setOriginalTags] = useState([]);
  const [originalFocusedTags, setOriginalFocusedTags] = useState([]);
  
  // AI suggestions state
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);

  const [showAiSuggestions, setShowAiSuggestions] = useState(false);

  useEffect(() => {
    if (id) {
      loadImage();
      loadNavigationContext();
      loadRoomsAndStages();
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRoomsAndStages = async () => {
    try {
      const [roomsResponse, stagesResponse] = await Promise.all([
        fetch('/api/rooms'),
        fetch('/api/stages')
      ]);

      if (roomsResponse.ok) {
        const rooms = await roomsResponse.json();
        setAvailableRooms(rooms);
      }

      if (stagesResponse.ok) {
        const stages = await stagesResponse.json();
        setAvailableStages(stages);
      }
    } catch (error) {
      console.error('Error loading rooms and stages:', error);
    }
  };

  const loadNavigationContext = useCallback(async () => {
    try {
      // Get current search/filter context from URL params or localStorage
      const urlParams = new URLSearchParams(location.search);
      const searchTerm = urlParams.get('search') || '';
      const filterTags = urlParams.get('tags') ? urlParams.get('tags').split(',') : [];
      
      // Fetch all images with the same filter context
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);
      if (filterTags.length > 0) queryParams.append('tags', filterTags.join(','));
      
      const response = await fetch(`/api/images?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to load navigation context');
      
      const responseData = await response.json();
      const images = Array.isArray(responseData) ? responseData : responseData.images || [];
      const currentIndex = images.findIndex(img => img.id === parseInt(id));
      
      setNavigationContext({
        images,
        currentIndex,
        searchTerm,
        filterTags,
        hasNext: currentIndex < images.length - 1,
        hasPrevious: currentIndex > 0
      });
    } catch (error) {
      console.error('Error loading navigation context:', error);
      // Set minimal context if loading fails
      setNavigationContext({
        images: [],
        currentIndex: -1,
        searchTerm: '',
        filterTags: [],
        hasNext: false,
        hasPrevious: false
      });
    }
  }, [id, location.search]);

  // Check for unsaved changes
  useEffect(() => {
    const tagsChanged = JSON.stringify(tags.sort()) !== JSON.stringify(originalTags.sort());
    const focusedTagsChanged = JSON.stringify(focusedTags) !== JSON.stringify(originalFocusedTags);
    const projectAssignmentsChanged = JSON.stringify(projectAssignments) !== JSON.stringify(originalProjectAssignments);
    setHasUnsavedChanges(tagsChanged || focusedTagsChanged || projectAssignmentsChanged);
  }, [tags, focusedTags, projectAssignments, originalTags, originalFocusedTags, originalProjectAssignments]);

  const navigateToNext = () => {
    if (!navigationContext || !navigationContext.hasNext) return;
    
    const nextImage = navigationContext.images[navigationContext.currentIndex + 1];
    if (nextImage) {
      // Preserve search/filter context in URL
      const urlParams = new URLSearchParams(location.search);
      navigate(`/image/${nextImage.id}?${urlParams.toString()}`);
    }
  };

  const navigateToPrevious = () => {
    if (!navigationContext || !navigationContext.hasPrevious) return;
    
    const previousImage = navigationContext.images[navigationContext.currentIndex - 1];
    if (previousImage) {
      // Preserve search/filter context in URL
      const urlParams = new URLSearchParams(location.search);
      navigate(`/image/${previousImage.id}?${urlParams.toString()}`);
    }
  };

  useEffect(() => {
    // Start with fallback mode immediately if we detect potential issues
    if (image && !useFallbackMode) {
      console.log('Starting image editor initialization...');
      
      // Immediate fallback for faster loading
      console.log('Using fallback mode for better reliability');
      setUseFallbackMode(true);
      setCanvasReady(true);
      
      return; // Skip canvas initialization entirely
    }
    
    if (image && canvasRef.current && !fabricCanvasRef.current && !useFallbackMode) {
      // This code path is now disabled in favor of immediate fallback
      console.log('Canvas initialization skipped - using fallback mode');
    }
    
    return () => {
      if (fabricCanvasRef.current) {
        try {
          // Clear all objects before disposing
          fabricCanvasRef.current.clear();
          fabricCanvasRef.current.dispose();
        } catch (error) {
          console.log('Canvas disposal error (non-critical):', error);
        }
        fabricCanvasRef.current = null;
      }
      
      // Clean up fallback timeout
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      
      setCanvasReady(false);
      setPendingTagLocation(null);
      setIsTaggingMode(false);
      setUseFallbackMode(false);
      setEditingTagIndex(null);
      setResizing(false);
      setDragging(false);
      setEditingTagName(null);
      setEditingTagText('');
    };
  }, [image]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadImage = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/images/${id}`);
      if (!response.ok) throw new Error('Failed to load image');
      
      const imageData = await response.json();
      setImage(imageData);
      
      // Parse tags properly - handle both string and array formats
      const parsedTags = Array.isArray(imageData.tags) 
        ? imageData.tags 
        : (typeof imageData.tags === 'string' 
          ? imageData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : []);
      
      setTags(parsedTags);
      setFocusedTags(imageData.focused_tags || []);
      setEditableName(imageData.name || '');
      setProjectAssignments(imageData.project_assignments || []);
      
      console.log('🔧 DEBUG: Loaded tags from server:', imageData.tags);
      console.log('🔧 DEBUG: Tags type:', typeof imageData.tags);
      console.log('🔧 DEBUG: Tags isArray:', Array.isArray(imageData.tags));
      console.log('🔧 DEBUG: Parsed tags:', parsedTags);
      
      // Store original values for change tracking
      setOriginalTags([...parsedTags]);
      setOriginalFocusedTags([...(imageData.focused_tags || [])]);
      setOriginalProjectAssignments([...(imageData.project_assignments || [])]);
    } catch (error) {
      console.error('Error loading image:', error);
      toast.error('Failed to load image');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const loadAiSuggestions = async () => {
    if (!image) return;
    
    try {
      setLoadingAiSuggestions(true);
      console.log('🤖 Loading AI suggestions for image:', image.id);
      
      const response = await fetch(`/api/images/${image.id}/suggestions`);
      if (!response.ok) throw new Error('Failed to load AI suggestions');
      
      const data = await response.json();
      console.log('🎯 AI suggestions received:', data);
      
      setAiSuggestions(data.suggestions || []);
      setShowAiSuggestions(true);
      
      if (data.suggestions?.length > 0) {
        toast.success(`Found ${data.suggestions.length} AI tag suggestions`);
      } else {
        toast.info('No additional AI suggestions found for this image');
      }
    } catch (error) {
      console.error('Error loading AI suggestions:', error);
      toast.error('Failed to load AI suggestions');
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  const initializeFabricCanvas = useCallback(() => { // eslint-disable-line no-unused-vars
    if (!canvasRef.current || !image || fabricCanvasRef.current) return;

    try {
      // Ensure canvas element is ready
      const canvasElement = canvasRef.current;
      if (!canvasElement || !canvasElement.getContext || canvasElement.offsetWidth === 0) {
        console.error('Canvas element not ready or not visible');
        return;
      }

      // Initialize fabric canvas directly (fabric will handle canvas setup)
      const canvas = new fabric.Canvas(canvasElement, {
        width: 800,
        height: 600,
        backgroundColor: '#f8f9fa',
        interactive: true,
        selection: false // Disable multi-selection rectangle
      });

      // Clear any existing fabric objects
      canvas.clear();
      canvas.setBackgroundColor('#f8f9fa', canvas.renderAll.bind(canvas));
      
      console.log('Canvas initialized successfully');

      fabricCanvasRef.current = canvas;

      // Test canvas functionality before proceeding
      try {
        canvas.clear();
        canvas.renderAll();
        console.log('Canvas functionality test passed');
      } catch (canvasTestError) {
        console.error('Canvas functionality test failed:', canvasTestError);
        throw canvasTestError; // This will trigger the fallback mode
      }

      // Add image to canvas
      if (image.url) {
        fabric.Image.fromURL(image.url, (img) => {
          if (!img || !fabricCanvasRef.current) {
            console.error('Failed to load image or canvas disposed');
            console.log('Switching to fallback mode due to image load failure');
            setUseFallbackMode(true);
            setCanvasReady(true);
            return;
          }
          
          try {
            const scale = Math.min(800 / img.width, 600 / img.height);
            img.scale(scale);
            img.set({
              left: (800 - img.width * scale) / 2,
              top: (600 - img.height * scale) / 2,
              selectable: false,
              evented: false
            });
            canvas.add(img);
            canvas.sendToBack(img);
            
            // Add existing focused tags
            focusedTags.forEach(tag => addTagRegion(tag));
            
            // Mark canvas as ready
            setCanvasReady(true);
            console.log('Canvas mode ready');
          } catch (imageAddError) {
            console.error('Error adding image to canvas:', imageAddError);
            console.log('Switching to fallback mode due to image add failure');
            setUseFallbackMode(true);
            setCanvasReady(true);
          }
        }, { crossOrigin: 'anonymous' });
      } else {
        // No image URL available, mark as ready anyway
        setCanvasReady(true);
      }

              // Handle canvas clicks for tagging
        canvas.on('mouse:down', (event) => {
          try {
            console.log('Canvas clicked, tagging mode:', isTaggingMode);
            if (!isTaggingMode) return;
            
            const pointer = canvas.getPointer(event.e);
            console.log('Click coordinates:', pointer.x, pointer.y);
            
            // Store the click location and show tag input
            setPendingTagLocation({ x: pointer.x, y: pointer.y });
            
            // Add a temporary visual indicator
            const indicator = new fabric.Circle({
              left: pointer.x - 10,
              top: pointer.y - 10,
              radius: 8,
              fill: 'rgba(59, 130, 246, 0.7)',
              stroke: '#3b82f6',
              strokeWidth: 2,
              selectable: false,
              evented: false,
              id: 'temp-indicator'
            });

            canvas.add(indicator);
            canvas.renderAll();
          } catch (clickError) {
            console.error('Canvas click handling failed:', clickError);
            console.log('Switching to fallback mode due to click handling failure');
            setUseFallbackMode(true);
          }
        });

        // Add error handling for fabric.js runtime errors
        const handleFabricError = (event) => {
          if (event.error && event.error.message && event.error.message.includes('clearRect')) {
            console.error('Fabric.js runtime error detected:', event.error);
            console.log('Switching to fallback mode due to fabric.js runtime error');
            setUseFallbackMode(true);
            setCanvasReady(true);
            // Remove the error listener once fallback is activated
            window.removeEventListener('error', handleFabricError);
          }
        };
        
        window.addEventListener('error', handleFabricError);
    } catch (error) {
      console.error('Error initializing fabric canvas:', error);
      toast.error('Failed to initialize image editor');
      setCanvasReady(false);
    }
  }, [image, focusedTags, isTaggingMode]);

  // Removed handleCanvasClick - logic moved to inline event handler

  const createTagAtLocation = () => {
    if (!pendingTagLocation || !newTag.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    const { x, y } = pendingTagLocation;

    if (useFallbackMode) {
      // Fallback mode: calculate relative coordinates
      const imageElement = document.querySelector('img[src="' + image.url + '"]');
      if (imageElement) {
        const rect = imageElement.getBoundingClientRect();
        const relativeX = x / rect.width;
        const relativeY = y / rect.height;
        
        const focusedTag = {
          tag_name: newTag,
          x_coordinate: relativeX,
          y_coordinate: relativeY,
          width: 0.125, // Fixed width for fallback mode
          height: 0.083
        };

        setFocusedTags(prev => [...prev, focusedTag]);
      }
    } else {
      // Canvas mode: remove temporary indicator and create fabric objects
      if (fabricCanvasRef.current) {
        const objects = fabricCanvasRef.current.getObjects();
        const indicator = objects.find(obj => obj.id === 'temp-indicator');
        if (indicator) {
          fabricCanvasRef.current.remove(indicator);
        }

        const rect = new fabric.Rect({
          left: x - 50,
          top: y - 25,
          width: 100,
          height: 50,
          fill: 'rgba(59, 130, 246, 0.3)',
          stroke: '#3b82f6',
          strokeWidth: 2,
          cornerColor: '#3b82f6',
          cornerStyle: 'circle',
          transparentCorners: false
        });

        const text = new fabric.Text(newTag, {
          left: x - 45,
          top: y - 35,
          fontSize: 12,
          fill: '#1f2937',
          fontFamily: 'Arial',
          selectable: false,
          evented: false
        });

        const group = new fabric.Group([rect, text], {
          left: x - 50,
          top: y - 50,
          tagName: newTag
        });

        fabricCanvasRef.current.add(group);
        fabricCanvasRef.current.renderAll();
        
        const focusedTag = {
          tag_name: newTag,
          x_coordinate: (x - 50) / 800,
          y_coordinate: (y - 50) / 600,
          width: 100 / 800,
          height: 50 / 600
        };

        setFocusedTags(prev => [...prev, focusedTag]);
      }
    }

    setNewTag('');
    setPendingTagLocation(null);
    setIsTaggingMode(false);
  };

  const cancelTagging = () => {
    // Remove temporary indicator
    if (fabricCanvasRef.current) {
      const objects = fabricCanvasRef.current.getObjects();
      const indicator = objects.find(obj => obj.id === 'temp-indicator');
      if (indicator) {
        fabricCanvasRef.current.remove(indicator);
        fabricCanvasRef.current.renderAll();
      }
    }
    
    setPendingTagLocation(null);
    setNewTag('');
    setIsTaggingMode(false);
  };

  const handleResizeStart = (e, tagIndex, direction) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const imageElement = document.querySelector('img[src="' + image.url + '"]');
    if (!imageElement) return;
    
    const imageRect = imageElement.getBoundingClientRect();
    const tag = focusedTags[tagIndex];
    
    const startValues = {
      x: tag.x_coordinate,
      y: tag.y_coordinate,
      width: tag.width || 0.125,
      height: tag.height || 0.083
    };
    
    console.log('Resize start:', direction, startValues);
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / imageRect.width;
      const deltaY = (moveEvent.clientY - startY) / imageRect.height;
      
      let newValues = { ...startValues };
      
      switch (direction) {
        case 'se': // bottom-right corner
          newValues.width = Math.max(0.05, startValues.width + deltaX);
          newValues.height = Math.max(0.03, startValues.height + deltaY);
          break;
          
        case 'sw': // bottom-left corner
          const newWidth = Math.max(0.05, startValues.width - deltaX);
          newValues.x = startValues.x - (newWidth - startValues.width);
          newValues.width = newWidth;
          newValues.height = Math.max(0.03, startValues.height + deltaY);
          break;
          
        case 'ne': // top-right corner
          const newHeight = Math.max(0.03, startValues.height - deltaY);
          newValues.y = startValues.y - (newHeight - startValues.height);
          newValues.width = Math.max(0.05, startValues.width + deltaX);
          newValues.height = newHeight;
          break;
          
        case 'nw': // top-left corner
          const newWidthNW = Math.max(0.05, startValues.width - deltaX);
          const newHeightNW = Math.max(0.03, startValues.height - deltaY);
          newValues.x = startValues.x - (newWidthNW - startValues.width);
          newValues.y = startValues.y - (newHeightNW - startValues.height);
          newValues.width = newWidthNW;
          newValues.height = newHeightNW;
          break;
        default:
          break;
      }
      
      // Ensure the region doesn't go outside the image bounds
      newValues.x = Math.max(0, Math.min(1 - newValues.width, newValues.x));
      newValues.y = Math.max(0, Math.min(1 - newValues.height, newValues.y));
      
      // Update the tag
      setFocusedTags(prev => prev.map((t, i) => 
        i === tagIndex ? { ...t, ...newValues } : t
      ));
    };
    
    const handleMouseUp = () => {
      setResizing(false);
      console.log('Resize ended');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const removeFocusedTag = (index) => {
    setFocusedTags(prev => prev.filter((_, i) => i !== index));
    setEditingTagIndex(null);
    setEditingTagName(null);
    setEditingTagText('');
  };

  const handleStartEditingTagName = (index, currentName) => {
    setEditingTagName(index);
    setEditingTagText(currentName);
  };

  const handleSaveTagName = (index) => {
    if (editingTagText.trim() && editingTagText !== focusedTags[index].tag_name) {
      setFocusedTags(prev => prev.map((tag, i) => 
        i === index ? { ...tag, tag_name: editingTagText.trim() } : tag
      ));
    }
    setEditingTagName(null);
    setEditingTagText('');
  };

  const handleDragStart = (e, tagIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const imageElement = document.querySelector('img[src="' + image.url + '"]');
    if (!imageElement) return;
    
    const imageRect = imageElement.getBoundingClientRect();
    const tag = focusedTags[tagIndex];
    
    const startValues = {
      x: tag.x_coordinate,
      y: tag.y_coordinate
    };
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / imageRect.width;
      const deltaY = (moveEvent.clientY - startY) / imageRect.height;
      
      const newX = Math.max(0, Math.min(1 - (tag.width || 0.125), startValues.x + deltaX));
      const newY = Math.max(0, Math.min(1 - (tag.height || 0.083), startValues.y + deltaY));
      
      // Update the tag position
      setFocusedTags(prev => prev.map((t, i) => 
        i === tagIndex ? { ...t, x_coordinate: newX, y_coordinate: newY } : t
      ));
    };
    
    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const addTagRegion = (tagData) => {
    if (!fabricCanvasRef.current) return;

    const rect = new fabric.Rect({
      left: tagData.x_coordinate * 800,
      top: tagData.y_coordinate * 600,
      width: (tagData.width || 0.125) * 800,
      height: (tagData.height || 0.083) * 600,
      fill: 'rgba(59, 130, 246, 0.3)',
      stroke: '#3b82f6',
      strokeWidth: 2,
      cornerColor: '#3b82f6',
      cornerStyle: 'circle',
      transparentCorners: false
    });

    const text = new fabric.Text(tagData.tag_name, {
      left: tagData.x_coordinate * 800 + 5,
      top: tagData.y_coordinate * 600 - 20,
      fontSize: 12,
      fill: '#1f2937',
      fontFamily: 'Arial',
      selectable: false,
      evented: false
    });

    const group = new fabric.Group([rect, text], {
      left: tagData.x_coordinate * 800,
      top: tagData.y_coordinate * 600,
      tagName: tagData.tag_name
    });

    fabricCanvasRef.current.add(group);
  };

  const addGeneralTag = async () => {
    if (!canEdit) return; // Prevent adding in view mode
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    
    const tag = newTag.trim();
    const newTags = [...tags, tag];
    setTags(newTags);
    setNewTag('');
    
    // Auto-save in edit mode
    try {
      const response = await fetch(`/api/images/${id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: newTags,
          focusedTags,
          name: editableName
        })
      });

      if (response.ok) {
        toast.success(`Added tag: ${tag}`);
      } else {
        // Revert on failure
        setTags(prev => prev.filter(t => t !== tag));
        toast.error('Failed to add tag');
      }
    } catch (error) {
      // Revert on failure
      setTags(prev => prev.filter(t => t !== tag));
      toast.error('Failed to add tag');
      console.error('Error adding tag:', error);
    }
  };

  const removeGeneralTag = async (tagToRemove) => {
    if (!canEdit) return; // Prevent removal in view mode
    
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    
    // Auto-save in edit mode
    try {
      const response = await fetch(`/api/images/${id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: newTags,
          focusedTags,
          name: editableName
        })
      });

      if (response.ok) {
        toast.success(`Removed tag: ${tagToRemove}`);
      } else {
        // Revert on failure
        setTags(prev => [...prev, tagToRemove]);
        toast.error('Failed to remove tag');
      }
    } catch (error) {
      // Revert on failure
      setTags(prev => [...prev, tagToRemove]);
      toast.error('Failed to remove tag');
      console.error('Error removing tag:', error);
    }
  };

  // Properties helper functions - now reactive to tag changes
  const getImageType = () => {
    const lowercaseTags = tags.map(tag => tag.toLowerCase());
    if (lowercaseTags.includes('archier')) return 'Archier';
    if (lowercaseTags.includes('precedent')) return 'Precedent';
    if (lowercaseTags.includes('texture')) return 'Texture';
    if (lowercaseTags.includes('photos')) return 'Photos';
    return 'General';
  };

  const getImageCategory = () => {
    const lowercaseTags = tags.map(tag => tag.toLowerCase());
    if (lowercaseTags.includes('complete')) return 'Complete';
    if (lowercaseTags.includes('wip')) return 'WIP';
    
    // Check for specific category tags
    const categoryTags = ['brick', 'carpet', 'concrete', 'fabric', 'metal', 'stone', 'tile', 'wood', 
                         'art', 'bathrooms', 'details', 'doors', 'exteriors', 'furniture', 'interiors', 
                         'joinery', 'kitchens', 'landscape', 'lighting', 'spatial', 'stairs', 'structure'];
    
    for (const tag of lowercaseTags) {
      if (categoryTags.includes(tag)) {
        return capitalizeForDisplay(tag);
      }
    }
    
    return 'General';
  };

  const getProject = () => {
    const lowercaseTags = tags.map(tag => tag.toLowerCase());
    
    // Check for project names
    const projectNames = ['taroona house', 'corner house', 'oakover preston', 'the boulevard',
                         'de witt st', 'couvreur', 'yandoit', 'archier'];
    
    for (const project of projectNames) {
      if (lowercaseTags.includes(project)) {
        return capitalizeForDisplay(project);
      }
    }
    
    // Check for team tags
    if (lowercaseTags.includes('archier')) return 'Archier';
    
    return null;
  };

  const getCategoryOptions = () => { // eslint-disable-line no-unused-vars
    const type = getImageType().toLowerCase();
    
    if (type === 'texture') {
      return [
        { value: 'brick', label: 'Brick' },
        { value: 'carpet', label: 'Carpet' },
        { value: 'concrete', label: 'Concrete' },
        { value: 'fabric', label: 'Fabric' },
        { value: 'metal', label: 'Metal' },
        { value: 'stone', label: 'Stone' },
        { value: 'tile', label: 'Tile' },
        { value: 'wood', label: 'Wood' },
        { value: 'general', label: 'General' }
      ];
    } else if (type === 'precedent') {
      return [
        { value: 'art', label: 'Art' },
        { value: 'bathrooms', label: 'Bathrooms' },
        { value: 'details', label: 'Details' },
        { value: 'doors', label: 'Doors' },
        { value: 'exteriors', label: 'Exteriors' },
        { value: 'furniture', label: 'Furniture' },
        { value: 'interiors', label: 'Interiors' },
        { value: 'joinery', label: 'Joinery' },
        { value: 'kitchens', label: 'Kitchens' },
        { value: 'landscape', label: 'Landscape' },
        { value: 'lighting', label: 'Lighting' },
        { value: 'spatial', label: 'Spatial' },
        { value: 'stairs', label: 'Stairs' },
        { value: 'structure', label: 'Structure' },
        { value: 'general', label: 'General' }
      ];
    } else {
      return [{ value: 'general', label: 'General' }];
    }
  };

  const getProjectTag = () => { // eslint-disable-line no-unused-vars
    const projectTags = ['yandoit', 'couvreur'];
    return tags.find(tag => projectTags.includes(tag.toLowerCase())) || '';
  };

  const getStageTag = () => { // eslint-disable-line no-unused-vars
    const stageTags = ['feasibility', 'layout', 'finishes'];
    return tags.find(tag => stageTags.includes(tag.toLowerCase())) || '';
  };

  const getRoomTag = () => { // eslint-disable-line no-unused-vars
    const roomTags = ['living', 'dining', 'kitchen', 'bathroom', 'bedroom'];
    return tags.find(tag => roomTags.includes(tag.toLowerCase())) || '';
  };


  const getDesign = () => { // eslint-disable-line no-unused-vars
    // All project names (current projects)
    const projectTags = ['couvreur', 'yandoit', 'de witt st', 'de witt', 'dewitt'];
    const foundProjects = tags.filter(tag => projectTags.includes(tag.toLowerCase()));
    return foundProjects.map(project => project.charAt(0).toUpperCase() + project.slice(1).toLowerCase()).join(', ');
  };

  // Project assignment helper functions
  const getCurrentProjects = () => {
    return [
      { id: 'de-witt', name: 'De Witt St' },
      { id: 'couvreur', name: 'Couvreur' }
    ];
  };

  const getCompleteProjects = () => {
    return [
      { id: 'yandoit', name: 'Yandoit' }
    ];
  };

  const getAllProjects = () => {
    return [...getCurrentProjects(), ...getCompleteProjects()];
  };

  const getRoomOptions = () => {
    return [
      { value: 'living', label: 'Living' },
      { value: 'dining', label: 'Dining' },
      { value: 'kitchen', label: 'Kitchen' },
      { value: 'bathroom', label: 'Bathroom' },
      { value: 'bedroom', label: 'Bedroom' }
    ];
  };

  const getStageOptions = () => {
    return [
      { value: 'feasibility', label: 'Feasibility' },
      { value: 'layout', label: 'Layout' },
      { value: 'finishes', label: 'Finishes' }
    ];
  };

  // Project assignment management functions
  const addProjectAssignment = () => {
    if (!canEdit) return;
    
    const newAssignment = {
      id: Date.now(), // temporary ID
      projectId: '',
      projectName: '',
      room: '',
      stage: ''
    };
    
    setProjectAssignments(prev => [...prev, newAssignment]);
  };

  const updateProjectAssignment = async (assignmentId, field, value) => {
    if (!canEdit) return;

    setProjectAssignments(prev => prev.map(assignment => {
      if (assignment.id === assignmentId) {
        const updated = { ...assignment, [field]: value };
        
        // If updating projectId, also update projectName and auto-add project tag
        if (field === 'projectId') {
          const project = getAllProjects().find(p => p.id === value);
          if (project) {
            updated.projectName = project.name;
            
            // Auto-add project tag (but not room/stage tags)
            const projectTagMap = {
              'de-witt': 'de witt st',
              'couvreur': 'couvreur',
              'yandoit': 'yandoit'
            };
            
            const projectTag = projectTagMap[value];
            if (projectTag && !tags.includes(projectTag)) {
              const newTags = [...tags, projectTag];
              setTags(newTags);
              // Auto-save tags
              updateTagsAndSave(newTags);
            }
          }
        }
        
        return updated;
      }
      return assignment;
    }));

    // Project assignment added - user needs to save manually
  };

  const removeProjectAssignment = (assignmentId) => {
    if (!canEdit) return;
    
    setProjectAssignments(prev => prev.filter(assignment => assignment.id !== assignmentId));
    // Removed auto-save - user needs to click "Save Changes" button
  };

  const updateImageType = async (newType) => { // eslint-disable-line no-unused-vars
    if (!canEdit) return;
    const oldTypeTags = ['precedent', 'texture', 'photos'];
    let updatedTags = tags.filter(tag => !oldTypeTags.includes(tag.toLowerCase()));
    updatedTags = [...updatedTags, newType];
    await updateTagsAndSave(updatedTags);
  };

  const updateImageCategory = async (newCategory) => { // eslint-disable-line no-unused-vars
    if (!canEdit) return;
    const allCategories = [
      'brick', 'carpet', 'concrete', 'fabric', 'metal', 'stone', 'tile', 'wood',
      'art', 'bathrooms', 'details', 'doors', 'exteriors', 'furniture', 'interiors', 
      'joinery', 'kitchens', 'landscape', 'lighting', 'spatial', 'stairs', 'structure', 'general'
    ];
    let updatedTags = tags.filter(tag => !allCategories.includes(tag.toLowerCase()));
    updatedTags = [...updatedTags, newCategory];
    await updateTagsAndSave(updatedTags);
  };

  const updateProjectTag = async (newProject) => { // eslint-disable-line no-unused-vars
    if (!canEdit) return;
    const projectTags = ['yandoit', 'couvreur'];
    let updatedTags = tags.filter(tag => !projectTags.includes(tag.toLowerCase()));
    if (newProject) updatedTags = [...updatedTags, newProject];
    await updateTagsAndSave(updatedTags);
  };

  const updateStageTag = async (newStage) => { // eslint-disable-line no-unused-vars
    if (!canEdit) return;
    const stageTags = ['feasibility', 'layout', 'finishes'];
    let updatedTags = tags.filter(tag => !stageTags.includes(tag.toLowerCase()));
    if (newStage) updatedTags = [...updatedTags, newStage];
    await updateTagsAndSave(updatedTags);
  };

  const updateRoomTag = async (newRoom) => { // eslint-disable-line no-unused-vars
    if (!canEdit) return;
    const roomTags = ['living', 'dining', 'kitchen', 'bathroom', 'bedroom'];
    let updatedTags = tags.filter(tag => !roomTags.includes(tag.toLowerCase()));
    if (newRoom) updatedTags = [...updatedTags, newRoom];
    await updateTagsAndSave(updatedTags);
  };

  const updateTagsAndSave = async (newTags) => {
    setTags(newTags);
    try {
      const response = await fetch(`/api/images/${id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags, focusedTags, name: editableName })
      });
      if (!response.ok) toast.error('Failed to update properties');
    } catch (error) {
      console.error('Error updating tags:', error);
      toast.error('Failed to update properties');
    }
  };

  // removeFocusedTag function moved up to avoid duplication

  const saveChanges = async () => {
    console.log('🔧 DEBUG: saveChanges function called');
    console.log('🔧 DEBUG: id =', id);
    console.log('🔧 DEBUG: tags =', tags);
    console.log('🔧 DEBUG: focusedTags =', focusedTags);
    
    try {
      console.log('🔧 DEBUG: Making API call to /api/images/' + id + '/tags');
      console.log('🔧 DEBUG: Request body:', { tags, focusedTags, name: editableName, projectAssignments });
      console.log('🔧 DEBUG: tags array contents:', tags);
      const response = await fetch(`/api/images/${id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags,
          focusedTags,
          name: editableName,
          projectAssignments
        })
      });

      console.log('🔧 DEBUG: Response status:', response.status);
      console.log('🔧 DEBUG: Response ok:', response.ok);

      if (!response.ok) throw new Error('Failed to save changes');
      
      // Update original values to reflect saved state
      setOriginalTags([...tags]);
      setOriginalFocusedTags([...focusedTags]);
      setOriginalProjectAssignments([...projectAssignments]);
      
      toast.success('Changes saved successfully');
      // Stay on editor page instead of navigating away
    } catch (error) {
      console.error('🔧 DEBUG: Error in saveChanges:', error);
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Loading image...</span>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Image not found</h3>
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-800"
        >
          Return to gallery
        </button>
      </div>
    );
  }

  // Check if image has a valid URL
  if (!image.url) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Image unavailable</h3>
        <p className="text-gray-600 mb-4">
          Unable to load image. This may be due to an expired access token or network issue.
        </p>
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-800"
        >
          Return to gallery
        </button>
      </div>
    );
  }

  // Wrap the entire render in error handling
  try {
    return (
      <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              // Check if user came from Projects page
              const fromProjects = location.state?.from === 'projects' || document.referrer.includes('/projects');
              if (fromProjects) {
                navigate('/projects');
              } else {
                navigate('/');
              }
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {location.state?.from === 'projects' || document.referrer.includes('/projects') ? 'Back to Projects' : 'Back to Gallery'}
          </button>
          <div>
            <h1 className="text-xl font-semibold">
              {image.title || image.filename}
            </h1>
            <p className="text-gray-600 text-sm">
              Click on the image to add focused tags
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={navigateToPrevious}
              disabled={!navigationContext?.hasPrevious}
              className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
              title="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            {navigationContext && (
              <span className="text-sm text-gray-500 px-2">
                {navigationContext.currentIndex + 1} of {navigationContext.images.length}
              </span>
            )}
            
            <button
              onClick={navigateToNext}
              disabled={!navigationContext?.hasNext}
              className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
              title="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          
          {/* Save button - only show in edit mode */}
          {canEdit && (
        <button
          onClick={saveChanges}
              disabled={!hasUnsavedChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium ${
                hasUnsavedChanges 
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              style={{ minWidth: '140px' }}
        >
          <Save className="h-4 w-4" />
          {hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
        </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas Area */}
        <div className="lg:col-span-2">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="font-semibold">Image Editor</h3>
              {canEdit && (
              <div className="flex gap-2">
                  <button
                    onClick={loadAiSuggestions}
                    disabled={loadingAiSuggestions || !image}
                    className="flex items-center gap-2 px-3 py-1 rounded-md text-sm bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lightbulb className={`h-4 w-4 ${loadingAiSuggestions ? 'animate-pulse' : ''}`} />
                    {loadingAiSuggestions ? 'Scanning...' : 'AI Scan'}
                  </button>
                <button
                  onClick={() => {
                    console.log('Toggling tagging mode from:', isTaggingMode, 'to:', !isTaggingMode);
                    setIsTaggingMode(!isTaggingMode);
                    if (isTaggingMode) {
                      // If exiting tagging mode, clean up
                      setPendingTagLocation(null);
                      setNewTag('');
                    }
                  }}
                  disabled={!canvasReady}
                  className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    isTaggingMode 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  {isTaggingMode ? 'Exit Tagging' : 'Add Region Tag'}
                </button>
              </div>
              )}
            </div>
            
            {isTaggingMode && !pendingTagLocation && (
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <p className="text-blue-600 text-sm font-medium mb-2">
                  Click anywhere on the image to select a location for your tag
                </p>
                <button
                  onClick={cancelTagging}
                  className="px-3 py-1 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}

            {pendingTagLocation && (
              <div className="mb-4 p-3 bg-green-50 rounded-md border border-green-200">
                <p className="text-green-600 text-sm font-medium mb-2">
                  Location selected! Enter a tag name:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter tag name..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createTagAtLocation()}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-green-500 focus:border-green-500"
                    autoFocus
                  />
                  <button
                    onClick={createTagAtLocation}
                    disabled={!newTag.trim()}
                    className="px-3 py-1 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Tag
                  </button>
                  <button
                    onClick={cancelTagging}
                    className="px-3 py-1 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            <div className="border rounded-lg overflow-hidden relative">
              {!canvasReady && !useFallbackMode && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                  <div className="text-center">
                    <div className="spinner mb-2"></div>
                    <p className="text-gray-600">Loading canvas...</p>
                    <p className="text-xs text-gray-500 mt-1">
                      If this takes too long, try refreshing the page
                    </p>
                  </div>
                </div>
              )}
              
              {/* Fallback Mode: Simple Image with Overlays */}
              {useFallbackMode ? (
                <div className="relative flex justify-center bg-gray-100">
                  <img
                    src={image.url}
                    alt={image.title || image.filename}
                    className="max-w-full h-auto mx-auto block"
                    style={{ 
                      maxHeight: '600px', 
                      maxWidth: '800px',
                      cursor: isTaggingMode && !pendingTagLocation ? 'crosshair' : 'default'
                    }}
                    onLoad={(e) => {
                      const img = e.target;
                      // Scale calculation removed
                      // Image scale calculation removed
                    }}
                    onClick={(e) => {
                      if (!isTaggingMode || pendingTagLocation) return;
                      
                      const rect = e.target.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      
                      console.log('Fallback image clicked at:', x, y);
                      setPendingTagLocation({ x, y });
                    }}
                  />
                  
                  {/* Render existing focused tags as overlays - now resizable */}
                  {focusedTags.map((tag, index) => (
                    <div
                      key={index}
                      className={`absolute border-2 border-gray-800 bg-gray-800 bg-opacity-80 group hover:bg-opacity-90 transition-all ${
                        editingTagIndex === index ? 'ring-2 ring-gray-900 cursor-move' : 'cursor-pointer'
                      } ${dragging ? 'cursor-grabbing' : ''}`}
                      style={{
                        left: `${tag.x_coordinate * 100}%`,
                        top: `${tag.y_coordinate * 100}%`,
                        width: `${(tag.width || 0.125) * 100}%`,
                        height: `${(tag.height || 0.083) * 100}%`,
                        fontSize: '12px',
                        color: '#1f2937',
                        minWidth: '60px',
                        minHeight: '40px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!resizing && !dragging) {
                          setEditingTagIndex(editingTagIndex === index ? null : index);
                        }
                      }}
                      onMouseDown={(e) => {
                        if (e.target.classList.contains('resize-handle')) return;
                        handleDragStart(e, index);
                      }}
                    >
                      <div className="absolute -top-6 left-0 bg-gray-800 text-white px-2 py-1 text-xs rounded flex items-center gap-1">
                        {editingTagName === index ? (
                          <input
                            type="text"
                            value={editingTagText}
                            onChange={(e) => setEditingTagText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveTagName(index);
                              } else if (e.key === 'Escape') {
                                setEditingTagName(null);
                                setEditingTagText('');
                              }
                            }}
                            onBlur={() => handleSaveTagName(index)}
                            className="bg-gray-700 text-white border border-gray-600 rounded px-1 text-xs"
                            style={{ width: '80px' }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditingTagName(index, tag.tag_name);
                            }}
                            className="cursor-pointer hover:underline"
                            title="Click to edit tag name"
                          >
                            {tag.tag_name}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFocusedTag(index);
                          }}
                          className="ml-1 text-gray-300 hover:text-white"
                          title="Delete tag"
                        >
                          ×
                        </button>
                      </div>
                      
                      {/* Resize handles - only show when editing */}
                      {editingTagIndex === index && (
                        <>
                          {/* Corner resize handles */}
                          <div
                            className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-gray-700 border border-white cursor-se-resize hover:bg-gray-800"
                            onMouseDown={(e) => handleResizeStart(e, index, 'se')}
                          />
                          <div
                            className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-gray-700 border border-white cursor-ne-resize hover:bg-gray-800"
                            onMouseDown={(e) => handleResizeStart(e, index, 'ne')}
                          />
                          <div
                            className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-gray-700 border border-white cursor-nw-resize hover:bg-gray-800"
                            onMouseDown={(e) => handleResizeStart(e, index, 'nw')}
                          />
                          <div
                            className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-gray-700 border border-white cursor-sw-resize hover:bg-gray-800"
                            onMouseDown={(e) => handleResizeStart(e, index, 'sw')}
                          />
                        </>
                      )}
                    </div>
                  ))}
                  
                  {/* Pending tag indicator - larger preview rectangle */}
                  {pendingTagLocation && (
                    <div
                      className="absolute border-2 border-gray-800 bg-gray-800 bg-opacity-60"
                      style={{
                        left: pendingTagLocation.x - 60,
                        top: pendingTagLocation.y - 30,
                        width: 120,
                        height: 60,
                        zIndex: 20
                      }}
                    />
                  )}
                </div>
              ) : (
                /* Canvas Mode */
                <canvas
                  ref={canvasRef}
                  className={`${isTaggingMode && !pendingTagLocation ? 'tagging-canvas active' : 'tagging-canvas'} ${!canvasReady ? 'opacity-50' : ''}`}
                  style={{
                    cursor: isTaggingMode && !pendingTagLocation ? 'crosshair' : 'default',
                    pointerEvents: 'auto',
                    position: 'relative',
                    zIndex: canvasReady ? 10 : 1
                  }}
                  onClick={(e) => {
                    console.log('HTML canvas clicked!', e);
                    if (isTaggingMode && !pendingTagLocation) {
                      console.log('Manual click handler triggered');
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Name Field */}
          <div className="bg-white p-4 rounded-lg shadow">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <input
              type="text"
              placeholder="Enter name..."
              value={editableName}
              onChange={(e) => setEditableName(e.target.value)}
              disabled={!canEdit}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm ${
                canEdit 
                  ? 'focus:ring-blue-500 focus:border-blue-500' 
                  : 'bg-gray-100 cursor-not-allowed'
              }`}
            />
            
            {/* File Info */}
            <div className="pt-3 border-t border-gray-200 mt-3 space-y-2 text-sm">
              <div>
                <span className="font-medium">Filename:</span>
                <span className="ml-2 text-gray-600">{image.filename}</span>
              </div>
              <div>
                <span className="font-medium">Uploaded:</span>
                <span className="ml-2 text-gray-600">
                  {new Date(image.upload_date).toLocaleDateString()}
                </span>
              </div>
              {image.file_size && (
                <div>
                  <span className="font-medium">Size:</span>
                  <span className="ml-2 text-gray-600">
                    {(image.file_size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* AI Suggestions */}
          {showAiSuggestions && aiSuggestions.length > 0 && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">AI Tag Suggestions</h3>
                </div>
                <button
                  onClick={() => setShowAiSuggestions(false)}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                {aiSuggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded-md border border-green-200">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{suggestion.tag}</span>
                      <span className="ml-2 text-sm text-green-600">({suggestion.confidence}%)</span>
                      {suggestion.reason && (
                        <div className="text-xs text-gray-500 mt-1">{suggestion.reason}</div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (!tags.includes(suggestion.tag)) {
                          setTags([...tags, suggestion.tag]);
                          toast.success(`Added tag: ${suggestion.tag}`);
                        }
                      }}
                      disabled={tags.includes(suggestion.tag)}
                      className="ml-2 px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {tags.includes(suggestion.tag) ? 'Added' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Properties */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-4">Properties</h3>
            
            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900">
                  {getImageType()}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900">
                  {getImageCategory()}
                </div>
              </div>

              {/* Project (complete projects - archier tagged) */}
              {getProject() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                  <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900">
                    {getProject()}
                  </div>
                </div>
              )}

              {/* Old Design/Stage/Room fields removed - now use Project Assignments section below */}

              {/* Additional Tags Input */}
              {canEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Tags</label>
                  <div className="flex gap-2 mb-2">
              <input
                type="text"
                      placeholder="Add custom tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addGeneralTag()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={addGeneralTag}
                className="px-3 py-2 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
              >
                <Tag className="h-4 w-4" />
              </button>
            </div>
                </div>
              )}

              {/* Display All Tags */}
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                >
                  {capitalizeForDisplay(tag)}
                    {canEdit && (
                  <button
                    onClick={() => removeGeneralTag(tag)}
                    className="hover:bg-blue-200 rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                    )}
                </span>
              ))}
              </div>
            </div>
          </div>

          {/* Project Assignments */}
          {canEdit && (
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Project Assignments</h3>
                <button
                  onClick={addProjectAssignment}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                >
                  <Plus className="h-4 w-4" />
                  Add Project
                </button>
              </div>
              
              <div className="space-y-4">
                {projectAssignments.map((assignment) => (
                  <div key={assignment.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="grid grid-cols-1 gap-3">
                      {/* Project Selection */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
                        <select
                          value={assignment.projectId}
                          onChange={(e) => updateProjectAssignment(assignment.id, 'projectId', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select Project</option>
                          <optgroup label="Current Projects">
                            {getCurrentProjects().map(project => (
                              <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Complete Projects">
                            {getCompleteProjects().map(project => (
                              <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Room Selection */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Room</label>
                        <select
                          value={assignment.room}
                          onChange={(e) => updateProjectAssignment(assignment.id, 'room', e.target.value)}
                          disabled={!assignment.projectId}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Room</option>
                          {getRoomOptions().map(room => (
                            <option key={room.value} value={room.value}>{room.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Stage Selection */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Stage</label>
                        <select
                          value={assignment.stage}
                          onChange={(e) => updateProjectAssignment(assignment.id, 'stage', e.target.value)}
                          disabled={!assignment.projectId}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Stage</option>
                          {getStageOptions().map(stage => (
                            <option key={stage.value} value={stage.value}>{stage.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Remove Button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => removeProjectAssignment(assignment.id)}
                          className="flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-800 text-sm"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Assignment Summary */}
                    {assignment.projectId && (
                      <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border">
                        <strong>Assignment:</strong> {assignment.projectName}
                        {assignment.room && ` → ${assignment.room.charAt(0).toUpperCase() + assignment.room.slice(1)}`}
                        {assignment.stage && ` (${assignment.stage.charAt(0).toUpperCase() + assignment.stage.slice(1)})`}
                      </div>
                    )}
                  </div>
                ))}

                {projectAssignments.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-sm">No project assignments yet</div>
                    <div className="text-xs mt-1">Add a project assignment to specify where this image should appear in project views</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Focused Tags */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-4">Region Tags</h3>
            
            <div className="space-y-2">
              {focusedTags.map((tag, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <span className="text-sm font-medium">{tag.tag_name}</span>
                  <button
                    onClick={() => removeFocusedTag(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {focusedTags.length === 0 && (
                <p className="text-gray-500 text-sm">
                  No region tags yet. Click "Add Region Tag" to start.
                </p>
              )}
            </div>
          </div>

            
              </div>
      </div>
    </div>
    );
  } catch (renderError) {
    console.error('ImageEditor render error:', renderError);
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Image Editor Error</h3>
        <p className="text-gray-600 mb-4">
          There was an error loading the image editor. Using simplified mode.
        </p>
        {image && image.url && (
          <div className="mt-6 flex flex-col items-center">
            <img
              src={image.url}
              alt={image.title || image.filename}
              className="max-w-full h-auto mx-auto block"
              style={{ maxHeight: '400px' }}
            />
            <div className="mt-4">
              <h4 className="font-medium">{image.title || image.filename}</h4>
              {image.description && (
                <p className="text-gray-600 text-sm mt-1">{image.description}</p>
              )}
            </div>
          </div>
        )}
        <div className="mt-6">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 mr-2"
          >
            Return to Gallery
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
};

export default ImageEditor; 