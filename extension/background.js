// Background service worker for SnapTag extension

console.log('🚀 SnapTag background script loaded!');

// Function to create context menus with proper error handling
let menusCreated = false;

function createContextMenus() {
  if (menusCreated) {
    console.log('🔧 Context menus already created, skipping...');
    return;
  }
  
  console.log('🔧 Creating SnapTag context menus...');
  
  // Remove any existing menus first
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error('❌ Error removing existing menus:', chrome.runtime.lastError);
      return;
    }
    
    console.log('🗑️ Cleared existing menus');
    
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
        menusCreated = true; // Mark as created after the last menu
      }
    });
  });
}

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 SnapTag extension installed/updated');
  menusCreated = false; // Reset flag on install/update
  createContextMenus();
});

// Create context menus on startup (in case of reload)
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 SnapTag extension starting up');
  menusCreated = false; // Reset flag on startup
  createContextMenus();
});

// Create them immediately when script loads (only if not already created)
createContextMenus();

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('🖱️ Context menu clicked:', info.menuItemId);
  console.log('📋 Menu info:', info);
  
    if (info.menuItemId === 'saveToSnapTag' || info.menuItemId === 'saveToSnapTagPage') {
    console.log('💾 Save to SnapTag clicked');
    console.log('🔍 Checking if this is an image...', {
      srcUrl: info.srcUrl,
      mediaType: info.mediaType,
      linkUrl: info.linkUrl,
      menuItemId: info.menuItemId
    });
    
    // Check if we have an image URL to save (this should work when right-clicking directly on images)
    if (info.srcUrl) {
      console.log('✅ Found image URL from context menu:', info.srcUrl);
      handleImageSave(info.srcUrl, tab);
    } else if (info.linkUrl && (info.linkUrl.match(/\.(jpg|jpeg|png|gif|bmp|tiff|tif|webp|heic|heif|svg|avif|jp2|j2k|jpx|jpm|tga|targa)$/i))) {
      console.log('✅ Found image link:', info.linkUrl);
      handleImageSave(info.linkUrl, tab);
    } else {
      console.log('🔍 No direct image URL found. Trying to find image at click location...');
      // Inject script to find image at click coordinates
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: findImageAtClick,
        args: [info]
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const imageUrl = results[0].result;
          console.log('✅ Found image via script:', imageUrl);
          handleImageSave(imageUrl, tab);
        } else {
          console.log('❌ No image found even with advanced detection.');
          console.log('💡 Please try right-clicking directly on an image.');
          // Show a notification to help the user
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'SnapTag - No Image Found',
            message: 'Please right-click directly on an image to save it.'
          });
        }
      });
    }
  } else if (info.menuItemId === 'savePageImagesToSnapTag' || info.menuItemId === 'saveAllImagesFromImage') {
    console.log('📦 Saving all images from page');
    // Save all images on page
    handleBulkImageSave(tab);
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveImage') {
    handleImageSave(request.imageUrl, sender.tab, request.metadata)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getPageImages') {
    getPageImages(sender.tab.id)
      .then(images => sendResponse({ success: true, images }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'openSnapTagApp') {
    // Get server URL from settings and open the web app
    getSettings().then(settings => {
      // Railway serves web app from the same domain as API
      const appUrl = settings.serverUrl.includes('localhost') 
        ? 'http://localhost:3000'  // Local development
        : settings.serverUrl;      // Production (Railway serves web app from root)
      chrome.tabs.create({ url: appUrl });
    });
    sendResponse({ success: true });
  }

  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['snaptagServer', 'defaultTags'], (result) => {
      sendResponse({ 
        success: true, 
        settings: {
          serverUrl: result.snaptagServer || 'https://snaptag.up.railway.app',
          defaultTags: result.defaultTags || []
        }
      });
    });
    return true;
  }

  if (request.action === 'saveSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle image saving
async function handleImageSave(imageUrl, tab, metadata = {}) {
  console.log('🚀 handleImageSave called with:', { imageUrl, tabUrl: tab?.url, metadata });
  
  try {
    const settings = await getSettings();
    const serverUrl = settings.serverUrl;
    console.log('⚙️ Using server URL:', serverUrl);

    // Get additional metadata from tab
    const imageMetadata = {
      imageUrl: imageUrl,
      sourceUrl: tab?.url,
      title: metadata.title || `Image from ${new URL(tab?.url || 'https://unknown.com').hostname}`,
      description: metadata.description || `Saved from ${tab?.title || 'Unknown page'}`,
      tags: metadata.tags || settings.defaultTags || [],
      focusedTags: metadata.focusedTags || []
    };
    console.log('📝 Image metadata:', imageMetadata);

    // Send to SnapTag server with optimized retry logic
    console.log('📡 Sending request to server...');
    let retryCount = 0;
    const maxRetries = 1; // Reduced to 1 retry for speed
    let response;
    
    while (retryCount <= maxRetries) {
      try {
        response = await fetch(`${serverUrl}/api/images/save-from-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(imageMetadata)
        });
        break; // Success, exit retry loop
      } catch (fetchError) {
        retryCount++;
        if (retryCount > maxRetries) {
          throw fetchError; // Final failure
        }
        console.log(`🔄 Retry ${retryCount}/${maxRetries} for image save after fetch error:`, fetchError.message);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay before retry (reduced)
      }
    }

    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        // Try to parse as JSON first (most errors)
        const errorData = await response.json();
        console.error('❌ Server error:', errorData);
        errorMessage = errorData.error || errorMessage;
      } catch (jsonError) {
        // If JSON parsing fails (like with 429 rate limit), use text response
        try {
          const textError = await response.text();
          console.error('❌ Server error (non-JSON):', textError);
          errorMessage = textError || errorMessage;
        } catch (textError) {
          console.error('❌ Error reading response:', textError);
        }
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    if (result.duplicate) {
      console.log('♻️ Duplicate image found:', result.filename);
      console.log('📅 Originally saved:', result.created_at);
      
      // Show duplicate notification instead of success
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'SnapTag - Duplicate Image',
        message: `This image was already saved as "${result.original_name}" on ${new Date(result.created_at).toLocaleDateString()}`
      });
      
      return result;
    } else {
      console.log('✅ Image saved successfully:', result);
      console.log('🎉 Success! Image saved:', result.filename);
      
      // Show success notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'SnapTag - Image Saved',
        message: `Image saved as "${result.filename}"`
      });
      
      // Send the saved image data to popup for real-time update
      console.log('📡 Attempting to send image data to popup for real-time update');
      try {
        chrome.runtime.sendMessage({
          action: 'imageAdded',
          imageData: result
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('📝 Popup not open or no response:', chrome.runtime.lastError.message);
          } else if (response && response.success) {
            console.log('✅ Real-time update sent successfully to popup');
          } else {
            console.log('📝 Popup received message but no response');
          }
        });
      } catch (error) {
        console.log('📝 Error sending real-time update:', error.message);
      }
      
      return result;
    }
  } catch (error) {
    console.error('❌ Error saving image:', error);
    console.error('💥 Failed to save image:', error.message);

    throw error;
  }
}

// Handle bulk image saving
async function handleBulkImageSave(tab) {
  try {
    // Inject script to get all images on the page
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getAllPageImages
    });

    const images = result.result;
    
    if (images.length === 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'SnapTag',
        message: 'No images found on this page'
      });
      return;
    }

    // Open popup to select images and tags
    chrome.action.openPopup();
    
    // Store images for popup to access
    chrome.storage.local.set({ 
      pendingImages: images,
      bulkSaveMode: true 
    });

  } catch (error) {
    console.error('Error getting page images:', error);
  }
}

// Function to be injected into page to get all images
function getAllPageImages() {
  const images = [];
  const imageElements = document.querySelectorAll('img');
  
  imageElements.forEach((img, index) => {
    if (img.src && img.src.startsWith('http') && img.naturalWidth > 100 && img.naturalHeight > 100) {
      images.push({
        src: img.src,
        alt: img.alt || '',
        title: img.title || '',
        width: img.naturalWidth,
        height: img.naturalHeight,
        index: index
      });
    }
  });

  return images;
}

// Function to be injected into page to find image at click location
function findImageAtClick(info) {
  console.log('🔍 Searching for image at click location...', info);
  
  // First, try to use the srcUrl if it was provided by the context menu
  if (info.srcUrl && info.srcUrl.startsWith('http')) {
    console.log('✅ Found image from context menu srcUrl:', info.srcUrl);
    return info.srcUrl;
  }
  
  // If no srcUrl, try to find the image at the click coordinates
  let targetImage = null;
  
  // Try to find element at click position if coordinates are available
  if (info.pageX !== undefined && info.pageY !== undefined) {
    console.log(`🎯 Searching at click position: (${info.pageX}, ${info.pageY})`);
    
    // Get element at the exact click position
    const elementAtClick = document.elementFromPoint(info.pageX, info.pageY);
    
    if (elementAtClick) {
      console.log('🎯 Element at click:', elementAtClick.tagName);
      
      // Check if it's an image
      if (elementAtClick.tagName === 'IMG' && elementAtClick.src) {
        console.log('✅ Found img element at click position');
        targetImage = elementAtClick.src;
      } 
      // Check if it has a background image
      else {
        const style = window.getComputedStyle(elementAtClick);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none') {
          const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
          if (match && match[1] && match[1].startsWith('http')) {
            console.log('✅ Found background image at click position');
            targetImage = match[1];
          }
        }
        
        // Check parent elements for images
        let parent = elementAtClick.parentElement;
        while (parent && !targetImage) {
          if (parent.tagName === 'IMG' && parent.src) {
            console.log('✅ Found img element in parent');
            targetImage = parent.src;
            break;
          }
          
          const parentStyle = window.getComputedStyle(parent);
          const parentBgImage = parentStyle.backgroundImage;
          if (parentBgImage && parentBgImage !== 'none') {
            const match = parentBgImage.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1] && match[1].startsWith('http')) {
              console.log('✅ Found background image in parent');
              targetImage = match[1];
              break;
            }
          }
          parent = parent.parentElement;
        }
      }
    }
  }
  
  // If we found a target image, return it
  if (targetImage) {
    console.log('🎯 Target image found:', targetImage.substring(0, 60) + '...');
    return targetImage;
  }
  
  // Fallback: Look for images in the general area or the largest visible image
  console.log('🔍 No specific image found, falling back to general search...');
  const images = [];
  
  // Look for all visible img tags
  const imgTags = Array.from(document.querySelectorAll('img'));
  console.log(`📷 Found ${imgTags.length} img tags`);
  
  imgTags.forEach((img, index) => {
    if (img.src && img.src.startsWith('http')) {
      const visible = img.offsetWidth > 0 && img.offsetHeight > 0;
      const area = img.offsetWidth * img.offsetHeight;
      if (visible && area > 1000) { // Only consider reasonably sized images
        images.push({ src: img.src, area: area });
      }
    }
  });
  
  // Sort by area (largest first) and return the largest image
  images.sort((a, b) => b.area - a.area);
  
  console.log(`📸 Found ${images.length} candidate images`);
  if (images.length > 0) {
    console.log('📋 Returning largest image:', images[0].src.substring(0, 60) + '...');
    return images[0].src;
  }
  
  console.log('❌ No suitable images found');
  return null;
}

// Get settings from storage
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['snaptagServer', 'defaultTags'], (result) => {
      resolve({
        serverUrl: result.snaptagServer || 'https://snaptag.up.railway.app',
        defaultTags: result.defaultTags || []
      });
    });
  });
}

// Handle extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup, but we can also add additional logic here
  console.log('SnapTag extension clicked on tab:', tab.url);
}); 