// Run this in Chrome DevTools to reset SnapTag extension settings
chrome.storage.sync.clear(() => {
  console.log('✅ SnapTag extension settings cleared!');
  console.log('🔄 Extension will now use Railway URL by default');
});
