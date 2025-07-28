# SnapTag - Image Database for Archier

A complete image tagging and management system that integrates with Dropbox, InDesign, and ArchiCAD. Save and tag images from the web with metadata that's searchable across professional design tools.

## Features

### 🏗️ Professional Integration
- **InDesign/ArchiCAD Compatible**: XMP/IPTC metadata embedded in images
- **Dropbox Storage**: All images stored in your Dropbox with full metadata
- **Universal Search**: Tags searchable within Dropbox, InDesign, and ArchiCAD

### 🌐 Web Collection
- **Browser Extension**: Right-click any image to save with tags
- **Bulk Saving**: Save multiple images from a page at once
- **Auto-metadata**: Automatic title and source URL capture

### 🏷️ Advanced Tagging
- **Multiple Tags**: Unlimited tags per image
- **Focused Tagging**: Click-to-tag specific regions in images (similar to Facebook)
- **Tag Management**: Auto-complete and tag suggestions

### 🔍 Smart Search
- **Metadata Search**: Search by title, description, tags, or filename
- **Visual Interface**: Beautiful gallery view with thumbnails
- **Recent Images**: Quick access to recently saved images

## Quick Start

### Prerequisites
- Node.js 18+ 
- Dropbox account and API access token
- ExifTool installed (`brew install exiftool` on macOS)

### 1. Installation
```bash
# Clone repository
git clone <repository-url>
cd snaptag

# Install dependencies
npm run install-all

# Create environment file
cp .env.example .env
# Edit .env with your Dropbox access token
```

### 2. Get Dropbox Access Token
1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Create new app → Scoped access → Full Dropbox access
3. Generate access token
4. Add token to `.env` file:
   ```
   DROPBOX_ACCESS_TOKEN=your_access_token_here
   ```

### 3. Start Development Server
```bash
# Start both frontend and backend
npm run dev

# Or start separately:
npm run server  # Backend on :3001
npm run client  # Frontend on :3000
```

### 4. Install Browser Extension
1. Open Chrome → Extensions → Developer mode
2. Click "Load unpacked" 
3. Select the `extension` folder
4. Pin the SnapTag extension to toolbar

## Usage

### Web App (http://localhost:3000)
- **Gallery**: View and search all images
- **Upload**: Drag & drop images with tagging
- **Tags**: Manage your tag vocabulary
- **Image Editor**: Add focused tags by clicking on image regions

### Browser Extension
- **Right-click images**: "Save to SnapTag" context menu
- **Extension popup**: Scan page for images, manage default tags
- **Quick save**: One-click saving with pre-configured tags

### Professional Tools Integration

#### InDesign
1. Images appear with metadata in Links panel
2. Search by keywords in Adobe Bridge
3. File info shows all tags and descriptions

#### ArchiCAD  
1. Library Manager shows IPTC keywords
2. Search library by tags
3. Metadata visible in Object Info

#### Dropbox
1. All images stored in `/SnapTag` folder
2. Search by filename includes tag keywords
3. Preview shows embedded metadata

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Browser Extension│    │ Web App      │    │ Professional    │
│ - Context menus │    │ - Gallery    │    │ Tools           │
│ - Quick save    │◄──►│ - Upload     │◄──►│ - InDesign      │
│ - Bulk import   │    │ - Tag editor │    │ - ArchiCAD      │
└─────────────────┘    └──────────────┘    │ - Adobe Bridge  │
                              │             └─────────────────┘
                              ▼
                    ┌──────────────────┐
                    │ SnapTag Server   │
                    │ - Express API    │
                    │ - Image processing│
                    │ - Metadata service│
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌─────────────┐    ┌─────────────┐
            │ Dropbox API │    │ SQLite DB   │
            │ - File storage│    │ - Metadata  │
            │ - Sync        │    │ - Search    │
            └─────────────┘    └─────────────┘
```

## Development

### Project Structure
```
snaptag/
├── server/              # Node.js backend
│   ├── services/        # Dropbox, metadata, database services
│   ├── data/           # SQLite database
│   └── server.js       # Main server file
├── client/             # React frontend
│   ├── src/components/ # React components
│   ├── public/         # Static assets
│   └── package.json    # Frontend dependencies
├── extension/          # Chrome extension
│   ├── manifest.json   # Extension config
│   ├── background.js   # Service worker
│   ├── popup.html/js   # Extension popup
│   └── icons/         # Extension icons
└── docker-compose.yml  # Deployment config
```

### API Endpoints
- `GET /api/images` - Search images
- `POST /api/images/upload` - Upload image file
- `POST /api/images/save-from-url` - Save image from URL
- `PUT /api/images/:id/tags` - Update image tags
- `GET /api/tags` - Get all available tags

### Database Schema
- **images**: File info, metadata, Dropbox paths
- **tags**: Tag vocabulary with usage counts
- **image_tags**: Many-to-many relationship
- **focused_tags**: Click-to-tag coordinates and labels

## Deployment

### Docker Deployment (Recommended)
```bash
# Set environment variables
export DROPBOX_ACCESS_TOKEN=your_token

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### Manual Deployment
```bash
# Install dependencies
npm run install-all

# Build frontend
npm run build

# Start production server
NODE_ENV=production npm start
```

### Environment Variables
```bash
PORT=3001                           # Server port
NODE_ENV=production                 # Environment
CLIENT_URL=http://localhost:3000    # Frontend URL
DROPBOX_ACCESS_TOKEN=xxx            # Dropbox API token
DB_PATH=./server/data/snaptag.db   # Database location
```

## Metadata Standards

SnapTag uses industry-standard metadata formats:

### XMP Fields
- `dc:subject` - Image tags/keywords
- `dc:title` - Image title
- `dc:description` - Image description
- `dc:creator` - Creator (Archier TagDrop)
- `dc:rights` - Copyright information

### IPTC Fields  
- `Keywords` - Searchable tags
- `Caption-Abstract` - Description
- `ObjectName` - Title
- `By-line` - Creator
- `CopyrightNotice` - Rights

### Custom Fields
- `XMP:SnapTagFocusedTags` - JSON array of region-specific tags

## Troubleshooting

### Common Issues

**"ExifTool not found"**
```bash
# macOS
brew install exiftool

# Ubuntu/Debian
sudo apt-get install libimage-exiftool-perl

# Windows
# Download from https://exiftool.org/
```

**"Dropbox API error"**
- Check access token is valid
- Ensure token has full Dropbox access
- Verify internet connection

**"Images not appearing in InDesign"**
- Check file is in Dropbox and synced
- Refresh Links panel in InDesign
- Verify XMP metadata with `exiftool -xmp image.jpg`

### Logs
```bash
# Development
npm run dev  # Console logs visible

# Production
docker-compose logs snaptag-app
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email [support@archier.com] or create an issue in the repository.

---

**Built for Archier** - Professional image management for architectural design teams. 