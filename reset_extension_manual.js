// SnapTag Extension Settings Reset Script
// Copy and paste this ENTIRE block into Chrome DevTools Console

console.log('🔧 SnapTag Extension Settings Reset');

// First, clear all existing settings
chrome.storage.sync.clear(() => {
  console.log('✅ Old settings cleared');
  
  // Then set the Railway URL explicitly
  chrome.storage.sync.set({
    'snaptagServer': 'https://snaptag.up.railway.app',
    'defaultTags': []
  }, () => {
    console.log('✅ New Railway settings saved!');
    console.log('🎯 Server URL set to: https://snaptag.up.railway.app');
    console.log('🔄 Please test right-click "Save to SnapTag" now');
  });
});

// Also verify the settings were set correctly
setTimeout(() => {
  chrome.storage.sync.get(['snaptagServer', 'defaultTags'], (result) => {
    console.log('📋 Current settings:', result);
  });
}, 1000); 