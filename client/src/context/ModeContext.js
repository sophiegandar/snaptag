import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

  // Deactivate Edit mode
  const deactivateEditMode = useCallback(() => {
    console.log('🔒 Switching to View Mode');
    setIsEditMode(false);
    setTimeRemaining(0);
    
    if (editModeTimer) {
      clearTimeout(editModeTimer);
      setEditModeTimer(null);
    }
  }, [editModeTimer]);

  // Activate Edit mode with 30-minute timer
  const activateEditMode = useCallback(() => {
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
  }, [editModeTimer, deactivateEditMode]);

  // Toggle between Edit and View mode  
  const toggleEditMode = useCallback(() => {
    if (isEditMode) {
      // Switch to View mode
      deactivateEditMode();
    } else {
      // Switch to Edit mode
      activateEditMode();
    }
  }, [isEditMode, deactivateEditMode, activateEditMode]);

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
  }, [isEditMode, timeRemaining, deactivateEditMode]);

  // Keyboard shortcut listener (Escape + E sequence for mode toggle)
  useEffect(() => {
    let escapePressed = false;
    let escapeTimeout = null;

    const handleKeyDown = (event) => {
      // Always log key presses to debug
      console.log('🔍 Key pressed:', {
        key: event.key,
        code: event.code,
        escapePressed: escapePressed,
        target: event.target.tagName
      });
      
      // Only trigger if not typing in an input field or modal
      if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        return;
      }

      if (event.key === 'Escape') {
        console.log('🔄 Escape pressed - waiting for E...');
        escapePressed = true;
        event.preventDefault();
        
        // Clear any existing timeout
        if (escapeTimeout) clearTimeout(escapeTimeout);
        
        // Reset escape state after 2 seconds
        escapeTimeout = setTimeout(() => {
          console.log('🔄 Escape sequence timed out');
          escapePressed = false;
        }, 2000);
      } else if (escapePressed && (event.key === 'e' || event.key === 'E')) {
        console.log('🔄 ESC + E sequence completed - triggering mode toggle...');
        event.preventDefault();
        toggleEditMode();
        escapePressed = false;
        if (escapeTimeout) clearTimeout(escapeTimeout);
      } else if (escapePressed) {
        // Any other key resets the sequence
        console.log('🔄 Escape sequence reset by other key');
        escapePressed = false;
        if (escapeTimeout) clearTimeout(escapeTimeout);
      }
    };

    console.log('🎧 Adding ESC + E keyboard event listener...');
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      console.log('🎧 Removing keyboard event listener...');
      document.removeEventListener('keydown', handleKeyDown, true);
      if (escapeTimeout) clearTimeout(escapeTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
