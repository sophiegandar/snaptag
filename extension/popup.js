// SnapTag Extension Popup JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const openAppBtn = document.getElementById('openApp');
  const saveAllImagesBtn = document.getElementById('saveAllImages');
  const scanPageBtn = document.getElementById('scanPage');
  const recentImagesDiv = document.getElementById('recentImages');
  
  // Modal elements
  const imageModal = document.getElementById('imageModal');
  const closeModalBtn = document.getElementById('closeModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDescription = document.getElementById('modalDescription');
  const modalTags = document.getElementById('modalTags');
  const imageGrid = document.getElementById('imageGrid');
  const saveSelectedImagesBtn = document.getElementById('saveSelectedImages');
  const cancelSaveBtn = document.getElementById('cancelSave');
  
  // Other elements
  const loadingOverlay = document.getElementById('loadingOverlay');
  const statusMessage = document.getElementById('statusMessage');

  // State
  let selectedImages = [];
  let pageImages = [];
  let settings = {};

  // Initialize popup
  init();

  // Listen for real-time updates from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Popup received message:', request.action);
    if (request.action === 'imageAdded' && request.imageData) {
      console.log('📥 Received new image from background:', request.imageData.filename);
      console.log('📊 Image data:', request.imageData);
      // Add the new image to the recent images display
      addImageToRecentImages(request.imageData);
      sendResponse({ success: true });
      return true; // Keep the message channel open
    }
    return false; // Close the message channel for other messages
  });

  async function init() {
    try {
      // Load settings
      await loadSettings();
      loadRecentImages();
      
      // Set up event listeners
      setupEventListeners();
      
    } catch (error) {
             console.error('Error initializing popup:', error);
       showStatus('Error initializing SnapTag', 'error');
    }
  }

  function setupEventListeners() {
    // Header buttons
    openAppBtn.addEventListener('click', openSnapTagApp);
    
    // Quick actions
    saveAllImagesBtn.addEventListener('click', findAndSaveImages);
    scanPageBtn.addEventListener('click', scanPageForImages);
    
    // Tags management

    
    // Modal controls
    closeModalBtn.addEventListener('click', closeModal);
    cancelSaveBtn.addEventListener('click', closeModal);
    saveSelectedImagesBtn.addEventListener('click', saveSelectedImages);
    
    // Close modal on backdrop click
    imageModal.addEventListener('click', (e) => {
      if (e.target === imageModal) {
        closeModal();
      }
    });
  }

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        if (response.success) {
          settings = response.settings;
        }
        resolve();
      });
    });
  }

  async function saveSettings() {
    const newSettings = {
      snaptagServer: settings.serverUrl
    };
    
    chrome.runtime.sendMessage({ 
      action: 'saveSettings', 
      settings: newSettings 
    });
  }

  function openSnapTagApp() {
    chrome.runtime.sendMessage({ action: 'openSnapTagApp' });
    window.close();
  }

  async function findAndSaveImages() {
    try {
      showLoading(true);
      
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Inject script to find images
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: findImagesOnPage
      });
      
      pageImages = result.result || [];
      
      if (pageImages.length === 0) {
        showStatus('No suitable images found on this page', 'error');
        showLoading(false);
        return;
      }
      
      // Show modal with images
      showImageSelectionModal();
      showLoading(false);
      
    } catch (error) {
      console.error('Error finding images:', error);
      showStatus('Error scanning page for images', 'error');
      showLoading(false);
    }
  }

  async function scanPageForImages() {
    try {
      saveAllImagesBtn.disabled = true;
      scanPageBtn.disabled = true;
      scanPageBtn.textContent = 'Scanning...';
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: findImagesOnPage
      });
      
      pageImages = result.result || [];
      
      scanPageBtn.textContent = `Found ${pageImages.length} images`;
      
      setTimeout(() => {
        scanPageBtn.textContent = 'Scan Page';
        saveAllImagesBtn.disabled = false;
        scanPageBtn.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('Error scanning page:', error);
      showStatus('Error scanning page', 'error');
      scanPageBtn.textContent = 'Scan Page';
      saveAllImagesBtn.disabled = false;
      scanPageBtn.disabled = false;
    }
  }

  function showImageSelectionModal() {
    // Populate modal with default values
    modalTags.value = defaultTags.join(', ');
    
    // Clear and populate image grid
    imageGrid.innerHTML = '';
    selectedImages = [];
    
    pageImages.forEach((image, index) => {
      const imageItem = document.createElement('div');
      imageItem.className = 'image-item';
      imageItem.dataset.index = index;
      
      imageItem.innerHTML = `
        <img src="${image.src}" alt="${image.alt}" loading="lazy">
        <div class="image-item-overlay">✓</div>
      `;
      
      imageItem.addEventListener('click', () => toggleImageSelection(index, imageItem));
      
      imageGrid.appendChild(imageItem);
    });
    
    imageModal.classList.remove('hidden');
  }

  function toggleImageSelection(index, element) {
    const isSelected = selectedImages.includes(index);
    
    if (isSelected) {
      selectedImages = selectedImages.filter(i => i !== index);
      element.classList.remove('selected');
    } else {
      selectedImages.push(index);
      element.classList.add('selected');
    }
    
    // Update save button text
    const count = selectedImages.length;
    saveSelectedImagesBtn.textContent = count > 0 ? `Save ${count} Selected` : 'Save Selected';
  }

  function closeModal() {
    imageModal.classList.add('hidden');
    selectedImages = [];
    pageImages = [];
    modalTitle.value = '';
    modalDescription.value = '';
    modalTags.value = '';
  }

  async function saveSelectedImages() {
    if (selectedImages.length === 0) {
      showStatus('Please select at least one image', 'error');
      return;
    }
    
    try {
      showLoading(true);
      closeModal();
      
      const title = modalTitle.value.trim();
      const description = modalDescription.value.trim();
      const tags = modalTags.value.split(',').map(tag => tag.trim()).filter(Boolean);
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      let savedCount = 0;
      const totalCount = selectedImages.length;
      
      for (const imageIndex of selectedImages) {
        const image = pageImages[imageIndex];
        
        try {
          const metadata = {
            title: title || `Image from ${new URL(tab.url).hostname}`,
            description: description || `Saved from ${tab.title}`,
            tags: tags.length > 0 ? tags : defaultTags
          };
          
          await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'saveImage',
              imageUrl: image.src,
              metadata: metadata
            }, (response) => {
              if (response.success) {
                savedCount++;
                resolve(response.result);
              } else {
                reject(new Error(response.error));
              }
            });
          });
          
        } catch (error) {
          console.error(`Error saving image ${imageIndex}:`, error);
        }
      }
      
      showLoading(false);
      
      if (savedCount === totalCount) {
        showStatus(`Successfully saved ${savedCount} images`, 'success');
      } else if (savedCount > 0) {
        showStatus(`Saved ${savedCount} of ${totalCount} images`, 'success');
      } else {
        showStatus('Failed to save images', 'error');
      }
      
      // Refresh recent images
      setTimeout(loadRecentImages, 1000);
      
    } catch (error) {
      console.error('Error saving images:', error);
      showStatus('Error saving images', 'error');
      showLoading(false);
    }
  }



  async function loadRecentImages() {
    try {
      console.log('🔄 Loading recent images from:', `${settings.serverUrl}/api/images?limit=6`);
      const response = await fetch(`${settings.serverUrl}/api/images?limit=6`);
      if (!response.ok) {
        throw new Error(`Failed to load recent images: ${response.status} ${response.statusText}`);
      }
      
      const images = await response.json();
      console.log('📊 Received images:', images.length);
      
      recentImagesDiv.innerHTML = '';
      
      if (images.length === 0) {
        recentImagesDiv.innerHTML = '<div class="loading">No images saved yet</div>';
        return;
      }
      
      images.slice(0, 6).forEach((image, index) => {
        console.log(`🖼️ Processing image ${index + 1}:`, image.filename, 'URL:', image.url ? 'available' : 'missing');
        
        const imageElement = document.createElement('div');
        imageElement.className = 'recent-image';
        
        if (image.url) {
          imageElement.innerHTML = `<img src="${image.url}" alt="${image.title || image.filename}" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+Cjx0ZXh0IHg9IjIwIiB5PSIyNCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjgiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';">`;
        } else {
          // Show placeholder for missing URL
          imageElement.innerHTML = `<div style="width: 60px; height: 60px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #9ca3af;">No Image</div>`;
        }
        
        imageElement.addEventListener('click', () => {
          chrome.tabs.create({ url: `${settings.serverUrl}/image/${image.id}` });
        });
        recentImagesDiv.appendChild(imageElement);
      });
      
      console.log('✅ Recent images loaded successfully');
      
    } catch (error) {
      console.error('❌ Error loading recent images:', error);
      recentImagesDiv.innerHTML = `<div class="loading">Unable to load recent images<br><small>${error.message}</small></div>`;
    }
  }

  function addImageToRecentImages(imageData) {
    try {
      console.log('🖼️ Adding image to recent images display:', imageData.filename);
      console.log('🔍 Image URL:', imageData.url);
      
      // Check if we already have this image (avoid duplicates)
      const existingImage = recentImagesDiv.querySelector(`img[alt*="${imageData.filename}"]`);
      if (existingImage) {
        console.log('📝 Image already exists in recent images, skipping');
        return;
      }

      // Clear "no images" message if present
      const noImagesMessage = recentImagesDiv.querySelector('.loading');
      if (noImagesMessage && noImagesMessage.textContent.includes('No images')) {
        recentImagesDiv.innerHTML = '';
      }

      // Create new image element
      const imageElement = document.createElement('div');
      imageElement.className = 'recent-image new-image'; // Add 'new-image' class for animation
      imageElement.innerHTML = `<img src="${imageData.url}" alt="${imageData.title || imageData.filename}" loading="lazy">`;
      imageElement.addEventListener('click', () => {
        chrome.tabs.create({ url: `${settings.serverUrl}/image/${imageData.id}` });
      });

      // Add to the beginning of the list (most recent first)
      recentImagesDiv.insertBefore(imageElement, recentImagesDiv.firstChild);

      // Remove the 'new-image' class after animation
      setTimeout(() => {
        imageElement.classList.remove('new-image');
      }, 1000);

      // Keep only the 6 most recent images
      const images = recentImagesDiv.querySelectorAll('.recent-image');
      if (images.length > 6) {
        for (let i = 6; i < images.length; i++) {
          images[i].remove();
        }
      }

      console.log('✅ Added new image to recent images display');
    } catch (error) {
      console.error('Error adding image to recent images:', error);
    }
  }

  function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
  }

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
    
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 4000);
  }

  
});

// Function to be injected into page to find images
function findImagesOnPage() {
  const images = [];
  const imageElements = document.querySelectorAll('img');
  
  imageElements.forEach((img, index) => {
    // Filter for meaningful images
    if (img.src && 
        img.src.startsWith('http') && 
        img.naturalWidth > 200 && 
        img.naturalHeight > 200 &&
        !img.src.includes('data:image') &&
        !img.src.includes('base64')) {
      
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
  
  // Sort by size (larger images first)
  images.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  return images.slice(0, 20); // Limit to top 20 images
} 