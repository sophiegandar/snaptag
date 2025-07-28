# 🚀 SnapTag Setup Guide

## Quick Start (5 minutes)

### 1. Prerequisites
```bash
# Check your versions
node --version  # Need v18+
npm --version   # Need v8+

# Install ExifTool (required for metadata)
# macOS:
brew install exiftool

# Ubuntu/Debian:
sudo apt-get install libimage-exiftool-perl

# Windows:
# Download from https://exiftool.org/
```

### 2. Get Dropbox Access Token
1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click "Create app"
3. Choose "Scoped access" → "Full Dropbox" → Name it "SnapTag"
4. In the app settings, generate an "Access Token"
5. Copy this token (you'll need it in step 4)

### 3. Setup SnapTag
```bash
# Clone and enter directory
git clone <your-repo-url>
cd snaptag

# Make setup script executable (macOS/Linux)
chmod +x start.sh

# Quick start
./start.sh
```

### 4. Configure Environment
```bash
# Edit the .env file created by the setup script
nano .env

# Add your Dropbox token:
DROPBOX_ACCESS_TOKEN=your_token_here
```

### 5. Install Browser Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Pin the SnapTag extension to your toolbar

## 🎯 You're Ready!

- **Web App**: http://localhost:3000
- **API Server**: http://localhost:3001
- **Extension**: Right-click any image → "Save to SnapTag"

---

## Alternative Setup Methods

### Option A: Manual Setup
```bash
# Install all dependencies
npm run install-all

# Create directories
mkdir -p temp server/data

# Start development servers
npm run dev
```

### Option B: Docker Setup
```bash
# Set environment variable
export DROPBOX_ACCESS_TOKEN=your_token_here

# Start with Docker
docker-compose up -d
```

---

## 📁 Project Structure

```
snaptag/
├── server/           # Node.js API server
├── client/           # React web app
├── extension/        # Chrome extension
├── start.sh          # Quick start script
├── package.json      # Main dependencies
└── docker-compose.yml # Docker config
```

---

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Required
DROPBOX_ACCESS_TOKEN=your_token_here

# Optional (defaults shown)
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:3000
DB_PATH=./server/data/snaptag.db
```

### Extension Icons
The extension needs PNG icons in `extension/icons/`:
- icon16.png (16x16)
- icon32.png (32x32)  
- icon48.png (48x48)
- icon128.png (128x128)

See `extension/README-icons.md` for details.

---

## 🎯 How to Use

### 1. Web App Features
- **Gallery**: View and search all tagged images
- **Upload**: Drag & drop images with tagging
- **Editor**: Click on images to add region-specific tags
- **Tags**: Manage your tag vocabulary

### 2. Browser Extension Features
- **Right-click any image**: "Save to SnapTag"
- **Extension popup**: Scan pages for multiple images
- **Default tags**: Set tags applied to all saves
- **Recent images**: Quick access to saved images

### 3. Professional Integration
- **InDesign**: Tags appear in Links panel metadata
- **ArchiCAD**: IPTC keywords in Library Manager
- **Adobe Bridge**: Search by keywords
- **Dropbox**: All images stored in `/SnapTag` folder

---

## 🔍 Troubleshooting

### Common Issues

**❌ "ExifTool not found"**
```bash
# Install ExifTool
brew install exiftool  # macOS
sudo apt install libimage-exiftool-perl  # Linux
```

**❌ "Failed to connect to Dropbox"**
- Check your access token in `.env`
- Ensure token has "Full Dropbox" permissions
- Test with: `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.dropboxapi.com/2/users/get_current_account`

**❌ "Port 3001 already in use"**
```bash
# Find and kill the process
lsof -ti:3001 | xargs kill -9

# Or change the port in .env
PORT=3002
```

**❌ Extension not loading**
- Ensure all files are in `extension/` folder
- Check Chrome console for errors
- Try disabling/re-enabling in chrome://extensions

### Getting Help

1. **Check the logs**:
   ```bash
   npm run dev  # Shows all console output
   ```

2. **Test the API**:
   ```bash
   curl http://localhost:3001/api/health
   ```

3. **Reset everything**:
   ```bash
   rm -rf node_modules client/node_modules
   rm -rf server/data temp
   npm run install-all
   ```

---

## 🚀 Production Deployment

### Docker (Recommended)
```bash
# Build and deploy
docker-compose -f docker-compose.yml --profile production up -d
```

### Manual Production
```bash
# Build client
npm run build

# Start production server
NODE_ENV=production npm start
```

---

## 📊 What's Included

### ✅ Fully Working Components
- **Backend API**: Complete Express server with SQLite
- **Dropbox Integration**: Upload, download, metadata sync
- **XMP/IPTC Metadata**: Industry-standard embedding
- **Browser Extension**: Context menus, popup interface
- **React Web App**: Gallery, upload, tagging, settings
- **Docker Setup**: One-command deployment

### 🎯 Professional Features
- **InDesign Compatible**: Metadata reads natively
- **ArchiCAD Ready**: IPTC keywords searchable
- **Focused Tagging**: Click regions on images (like Facebook)
- **Batch Operations**: Multi-image processing
- **Search & Filtering**: Advanced metadata search

---

## 🎉 Success!

You now have a complete, professional image tagging system that integrates with:
- ✅ **Dropbox** for storage
- ✅ **InDesign** for design work  
- ✅ **ArchiCAD** for architectural projects
- ✅ **Web browsing** for image collection
- ✅ **Team collaboration** for shared libraries

**Happy tagging! 📸✨** 