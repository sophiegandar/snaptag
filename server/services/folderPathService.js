const path = require('path');

class FolderPathService {
  constructor() {
    // Define the folder structure based on tags
    this.categoryFolders = [
      'facade',
      'finishes', 
      'joinery',
      'lighting',
      'sanitary',
      'wet areas'
    ];
  }

  /**
   * Generate folder path based on tag logic
   * @param {Array} tags - Array of tags for the image
   * @param {string} baseFolder - Base SnapTag folder path
   * @returns {string} Complete folder path
   */
  generateFolderPath(tags = [], baseFolder = '/SnapTag') {
    console.log('📁 Generating folder path for tags:', tags);
    
    // Normalize tags to lowercase for comparison
    const normalizedTags = tags.map(tag => tag.toLowerCase().trim());
    
    // Step 1: Determine primary folder (Archier vs Precedents)
    const primaryFolder = normalizedTags.includes('archier') ? 'Archier' : 'Precedents';
    console.log('📂 Primary folder:', primaryFolder);
    
    // Step 2: Determine category subfolder
    let categoryFolder = null;
    for (const category of this.categoryFolders) {
      if (normalizedTags.includes(category.toLowerCase())) {
        // Convert to proper case (e.g., 'wet areas' -> 'Wet Areas')
        categoryFolder = this.toProperCase(category);
        break;
      }
    }
    
    // Step 3: Build the complete path
    let folderPath = baseFolder;
    
    // Add primary folder
    folderPath = path.posix.join(folderPath, primaryFolder);
    
    // Add category folder if found
    if (categoryFolder) {
      folderPath = path.posix.join(folderPath, categoryFolder);
      console.log('📁 Category folder:', categoryFolder);
    }
    
    console.log('✅ Final folder path:', folderPath);
    return folderPath;
  }

  /**
   * Convert string to proper case (e.g., 'wet areas' -> 'Wet Areas')
   */
  toProperCase(str) {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  /**
   * Generate filename from tags (excluding folder-related tags)
   * @param {Array} tags - Array of tags
   * @param {string} originalExtension - Original file extension
   * @param {number} timestamp - Timestamp for uniqueness
   * @returns {string} Generated filename
   */
  generateTagBasedFilename(tags = [], originalExtension = '.jpg', timestamp = Date.now()) {
    console.log('🏷️ Generating tag-based filename for tags:', tags);
    
    // Normalize ALL tags (don't filter out any tags)
    const normalizedTags = tags
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => tag.length > 0);
    
    // Convert tags to filename-safe format
    const filenameTags = normalizedTags
      .map(tag => tag.replace(/[^a-z0-9]/g, '-')) // Replace non-alphanumeric with hyphens
      .map(tag => tag.replace(/-+/g, '-')) // Replace multiple hyphens with single
      .map(tag => tag.replace(/^-|-$/g, '')) // Remove leading/trailing hyphens
      .filter(tag => tag.length > 0);
    
    // Create base filename
    let filename;
    if (filenameTags.length > 0) {
      // Use ALL tags as filename (increase limit to accommodate more tags)
      filename = filenameTags.slice(0, 10).join('-'); // Increased limit to 10 tags
    } else {
      // Fallback to timestamp if no suitable tags
      filename = 'image';
    }
    
    // Add timestamp for uniqueness
    filename = `${timestamp}-${filename}`;
    
    // Ensure proper extension
    if (!originalExtension.startsWith('.')) {
      originalExtension = '.' + originalExtension;
    }
    
    const finalFilename = filename + originalExtension;
    console.log('✅ Generated filename:', finalFilename);
    
    return finalFilename;
  }

  /**
   * Get all possible folder paths for the current structure
   * @param {string} baseFolder - Base SnapTag folder path
   * @returns {Array} Array of all possible folder paths
   */
  getAllFolderPaths(baseFolder = '/SnapTag') {
    const paths = [];
    const primaryFolders = ['Archier', 'Precedents'];
    const categoryFolders = this.categoryFolders.map(cat => this.toProperCase(cat));
    
    for (const primary of primaryFolders) {
      // Add primary folder
      paths.push(path.posix.join(baseFolder, primary));
      
      // Add category subfolders
      for (const category of categoryFolders) {
        paths.push(path.posix.join(baseFolder, primary, category));
      }
    }
    
    return paths;
  }
}

module.exports = FolderPathService; 