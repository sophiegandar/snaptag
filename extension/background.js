// Background service worker for SnapTag extension

console.log('🚀 SnapTag background script loaded!');

// Function to create context menus
function createContextMenus() {
  console.log('🔧 Creating SnapTag context menus...');
  
  // Remove any existing menus first
  chrome.contextMenus.removeAll(() => {
    console.log('🗑️ Cleared existing menus');
    
    // Create individual image menu (simplified to show on all contexts for testing)
    chrome.contextMenus.create({
      id: 'saveToSnapTag',
      title: 'Save to SnapTag',
      contexts: ['all']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error creating image context menu:', chrome.runtime.lastError);
      } else {
        console.log('✅ Individual image context menu created successfully');
      }
    });

    // Create page menu
    chrome.contextMenus.create({
      id: 'savePageImagesToSnapTag',
      title: 'Save All Images to SnapTag',
      contexts: ['page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error creating page context menu:', chrome.runtime.lastError);
      } else {
        console.log('✅ Page context menu created successfully');
      }
    });
  });
}

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 SnapTag extension installed/updated');
  createContextMenus();
});

// Create context menus on startup (in case of reload)
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 SnapTag extension starting up');
  createContextMenus();
});

// Also create them immediately when script loads
createContextMenus();

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('🖱️ Context menu clicked:', info.menuItemId);
  console.log('📋 Menu info:', info);
  
    if (info.menuItemId === 'saveToSnapTag') {
    console.log('💾 Save to SnapTag clicked');
    console.log('🔍 Checking if this is an image...', {
      srcUrl: info.srcUrl,
      mediaType: info.mediaType,
      linkUrl: info.linkUrl
    });
    
    // Check if we have an image URL to save
    if (info.srcUrl) {
      console.log('✅ Found image URL:', info.srcUrl);
      handleImageSave(info.srcUrl, tab);
    } else if (info.linkUrl && (info.linkUrl.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i))) {
      console.log('✅ Found image link:', info.linkUrl);
      handleImageSave(info.linkUrl, tab);
    } else {
      console.log('🔍 No obvious image found. Trying to find image at click location...');
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
        }
      });
    }
  } else if (info.menuItemId === 'savePageImagesToSnapTag') {
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
    chrome.tabs.create({ url: 'http://localhost:3000' });
    sendResponse({ success: true });
  }

  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['snaptagServer', 'defaultTags'], (result) => {
      sendResponse({ 
        success: true, 
        settings: {
          serverUrl: result.snaptagServer || 'http://localhost:3001',
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
  console.log('🚀 handleImageSave called with:', { imageUrl, tabUrl: tab.url, metadata });
  
  try {
    const settings = await getSettings();
    const serverUrl = settings.serverUrl || 'http://localhost:3001';
    console.log('⚙️ Using server URL:', serverUrl);

    // Get additional metadata from tab
    const imageMetadata = {
      imageUrl: imageUrl,
      sourceUrl: tab.url,
      title: metadata.title || `Image from ${new URL(tab.url).hostname}`,
      description: metadata.description || `Saved from ${tab.title}`,
      tags: metadata.tags || settings.defaultTags || [],
      focusedTags: metadata.focusedTags || []
    };
    console.log('📝 Image metadata:', imageMetadata);

    // Send to SnapTag server
    console.log('📡 Sending request to server...');
    const response = await fetch(`${serverUrl}/api/images/save-from-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(imageMetadata)
    });

    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Server error:', errorData);
      throw new Error(errorData.error || 'Failed to save image');
    }

    const result = await response.json();
    console.log('✅ Image saved successfully:', result);
    console.log('🎉 Success! Image saved:', result.filename);

    return result;
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
  console.log('🔍 Searching for image in page...');
  
  // Try to find images in various ways
  const images = [];
  const backgroundImages = [];
  
  // 1. Look for regular img tags (visible ones first)
  const imgTags = Array.from(document.querySelectorAll('img'));
  console.log(`📷 Found ${imgTags.length} img tags`);
  
  imgTags.forEach((img, index) => {
    if (img.src && img.src.startsWith('http')) {
      const visible = img.offsetWidth > 0 && img.offsetHeight > 0;
      console.log(`📷 Img ${index}: ${img.src.substring(0, 60)}... (visible: ${visible})`);
      if (visible) {
        images.unshift(img.src); // Put visible images first
      } else {
        images.push(img.src);
      }
    }
  });
  
  // 2. Look for background images in CSS (enhanced detection)
  console.log('🎨 Scanning for background images...');
  document.querySelectorAll('*').forEach((el, index) => {
    const style = window.getComputedStyle(el);
    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== 'none') {
      // Multiple URL patterns to catch different formats
      const urlMatches = bgImage.match(/url\(['"]?(.*?)['"]?\)/g);
      if (urlMatches) {
        urlMatches.forEach(urlMatch => {
          const match = urlMatch.match(/url\(['"]?(.*?)['"]?\)/);
          if (match && match[1] && match[1].startsWith('http')) {
            const visible = el.offsetWidth > 0 && el.offsetHeight > 0;
            console.log(`🎨 Background image found: ${match[1].substring(0, 60)}... (visible: ${visible})`);
            backgroundImages.push(match[1]);
            if (visible) {
              images.unshift(match[1]); // Put visible background images first
            } else {
              images.push(match[1]);
            }
          }
        });
      }
    }
  });
  
  // 3. Look for images in links
  document.querySelectorAll('a[href]').forEach(link => {
    if (link.href.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
      images.push(link.href);
    }
  });
  
  console.log(`📸 Total images found: ${images.length}`);
  console.log(`🎨 Background images found: ${backgroundImages.length}`);
  console.log('📋 All images:', images.slice(0, 5)); // Show first 5
  
  // Return the first valid image found (prioritizing visible ones)
  return images.length > 0 ? images[0] : null;
}

// Get settings from storage
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['snaptagServer', 'defaultTags'], (result) => {
      resolve({
        serverUrl: result.snaptagServer || 'http://localhost:3001',
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