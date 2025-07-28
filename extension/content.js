// SnapTag Content Script
// This script runs on all web pages to enable image saving functionality

console.log('SnapTag content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageImages') {
    // Find all images on the page
    const images = Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      alt: img.alt || '',
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    })).filter(img => img.src && img.width > 50 && img.height > 50); // Filter out tiny images
    
    sendResponse({ images });
  }
  
  if (request.action === 'highlightImage') {
    // Add visual feedback when saving an image
    const img = document.querySelector(`img[src="${request.src}"]`);
    if (img) {
      img.style.outline = '3px solid #22c55e';
      img.style.outlineOffset = '2px';
      setTimeout(() => {
        img.style.outline = '';
        img.style.outlineOffset = '';
      }, 2000);
    }
  }
  
  return true; // Keep the message channel open
});

// Add a subtle indicator that SnapTag is active (optional)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSnapTag);
} else {
  initSnapTag();
}

function initSnapTag() {
  // Create a minimal indicator that SnapTag is active
  // This could be expanded later for additional functionality
  document.body.setAttribute('data-snaptag-active', 'true');
} 