// Manual reset script for SnapTag extension
// Run this in the extension's background page console

console.log('🔧 Manually refreshing SnapTag context menus...');

// Force remove all context menus
chrome.contextMenus.removeAll(() => {
  console.log('🗑️ All context menus cleared');
  
  // Wait a moment then recreate
  setTimeout(() => {
    console.log('🔧 Recreating context menus...');
    
    // Create individual image menu (right-click on image)
    chrome.contextMenus.create({
      id: 'saveToSnapTag',
      title: 'Save to SnapTag',
      contexts: ['image']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error creating image context menu:', chrome.runtime.lastError);
      } else {
        console.log('✅ Individual image context menu created successfully');
      }
    });

    // Create "Save All Images" menu for image context as well
    chrome.contextMenus.create({
      id: 'saveAllImagesFromImage',
      title: 'Save All Images to SnapTag',
      contexts: ['image']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error creating image "save all" context menu:', chrome.runtime.lastError);
      } else {
        console.log('✅ Image "save all" context menu created successfully');
      }
    });

    // Create page menus (right-click on page, not on image)
    chrome.contextMenus.create({
      id: 'saveToSnapTagPage',
      title: 'Save to SnapTag',
      contexts: ['page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error creating page context menu:', chrome.runtime.lastError);
      } else {
        console.log('✅ Page context menu created successfully');
      }
    });

    chrome.contextMenus.create({
      id: 'savePageImagesToSnapTag',
      title: 'Save All Images to SnapTag',
      contexts: ['page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error creating page "save all" context menu:', chrome.runtime.lastError);
      } else {
        console.log('✅ Page "save all" context menu created successfully');
      }
    });
    
    console.log('✅ Context menu refresh complete!');
  }, 500);
}); 