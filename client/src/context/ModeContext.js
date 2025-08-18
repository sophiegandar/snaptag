import React, { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext();

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

export const ModeProvider = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editModeTimer, setEditModeTimer] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Edit mode duration in milliseconds (30 minutes)
  const EDIT_MODE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Toggle between Edit and View mode
  const toggleEditMode = () => {
    if (isEditMode) {
      // Switch to View mode
      deactivateEditMode();
    } else {
      // Switch to Edit mode
      activateEditMode();
    }
  };

  // Activate Edit mode with 30-minute timer
  const activateEditMode = () => {
    console.log('🔓 Activating Edit Mode for 30 minutes...');
    setIsEditMode(true);
    setTimeRemaining(EDIT_MODE_DURATION);

    // Clear any existing timer
    if (editModeTimer) {
      clearTimeout(editModeTimer);
    }

    // Set new timer to automatically switch to View mode after 30 minutes
    const timer = setTimeout(() => {
      console.log('⏰ Edit Mode expired - switching to View Mode');
      deactivateEditMode();
    }, EDIT_MODE_DURATION);

    setEditModeTimer(timer);
  };

  // Deactivate Edit mode
  const deactivateEditMode = () => {
    console.log('🔒 Switching to View Mode');
    setIsEditMode(false);
    setTimeRemaining(0);
    
    if (editModeTimer) {
      clearTimeout(editModeTimer);
      setEditModeTimer(null);
    }
  };

  // Update time remaining every minute
  useEffect(() => {
    if (!isEditMode || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 60000; // Subtract 1 minute
        if (newTime <= 0) {
          deactivateEditMode();
          return 0;
        }
        return newTime;
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isEditMode, timeRemaining]);

  // Keyboard shortcut listener (Escape key for mode toggle)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Always log key presses to debug
      console.log('🔍 Key pressed:', {
        key: event.key,
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        target: event.target.tagName
      });
      
      // Use Escape key to toggle mode (safe key that won't conflict)
      if (event.key === 'Escape') {
        // Only trigger if not typing in an input field or modal
        if (!['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
          console.log('🔄 Escape pressed - triggering mode toggle...');
          event.preventDefault();
          toggleEditMode();
        }
      }
    };

    console.log('🎧 Adding keyboard event listener...');
    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => {
      console.log('🎧 Removing keyboard event listener...');
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [toggleEditMode]); // Add toggleEditMode to dependencies

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (editModeTimer) {
        clearTimeout(editModeTimer);
      }
    };
  }, [editModeTimer]);

  // Format time remaining for display
  const formatTimeRemaining = () => {
    if (!isEditMode || timeRemaining <= 0) return '';
    
    const minutes = Math.ceil(timeRemaining / 60000);
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  };

  const value = {
    isEditMode,
    isViewMode: !isEditMode,
    toggleEditMode,
    activateEditMode,
    deactivateEditMode,
    timeRemaining,
    formatTimeRemaining,
    // Helper functions for specific features
    canEdit: isEditMode,
    canDelete: isEditMode,
    canUpload: isEditMode,
    canAccessProWorkflow: isEditMode,
    canAccessSettings: isEditMode,
  };

  return (
    <ModeContext.Provider value={value}>
      {children}
    </ModeContext.Provider>
  );
};
