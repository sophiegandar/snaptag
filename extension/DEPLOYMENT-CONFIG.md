# 🔧 Chrome Extension Deployment Configuration

After deploying SnapTag to Railway/Render/etc, you need to update the Chrome extension to point to your new server.

## Quick Setup (Recommended)

### 1. Use Extension Settings
1. **Right-click the SnapTag extension icon**
2. **Click "Options" or "Settings"**  
3. **Enter your deployed server URL:**
   - Railway: `https://snaptag-production.railway.app`
   - Render: `https://snaptag.onrender.com`
   - Custom: `https://snaptag.archier.com.au`
4. **Click Save**

The extension will automatically use your deployed server!

---

## Manual Configuration (Advanced)

If you need to modify the extension code directly:

### 1. Update background.js
```javascript
// Find this line around line 126 and 148:
serverUrl: result.snaptagServer || 'http://localhost:3001',

// Change to:
serverUrl: result.snaptagServer || 'https://your-deployed-url.com',
```

### 2. Reload Extension
1. Go to `chrome://extensions/`
2. Click "Reload" on SnapTag extension
3. Test by right-clicking an image → "Save to SnapTag"

---

## Testing Deployment

### ✅ Verify Extension Works
1. **Right-click any image** → "Save to SnapTag"
2. **Check console** (F12) for connection errors
3. **Visit your web app** to see saved images
4. **Check Dropbox** for uploaded files

### ❌ Troubleshooting
- **"Connection failed"** → Check server URL in extension settings
- **"CORS error"** → Verify your domain is allowed in server CORS config  
- **"Dropbox error"** → Check environment variables in deployment

---

## Team Distribution

### Option 1: Chrome Web Store (Professional)
1. Package extension with your server URL
2. Submit to Chrome Web Store
3. Team installs from store

### Option 2: Direct Installation (Quick)
1. Update `background.js` with your server URL
2. Zip the `extension/` folder
3. Share with team
4. Team loads via "Developer mode" in `chrome://extensions/`

### Option 3: Settings Configuration (Flexible)
1. Share extension as-is
2. Team configures server URL in extension settings
3. Most flexible for multiple environments

---

## Multi-Environment Setup

For teams using multiple SnapTag instances:

```javascript
// In background.js, you can set different defaults:
const environments = {
  development: 'http://localhost:3001',
  staging: 'https://snaptag-staging.railway.app', 
  production: 'https://snaptag.archier.com.au'
};

const defaultUrl = environments.production; // Change as needed
```

**Recommended: Use extension settings to switch between environments easily.** 