const path = require('path');

class FolderPathService {
  constructor() {
    // Define the NEW folder structure based on updated requirements
    this.precedentCategories = [
      'facade',
      'finishes', 
      'screens',
      'joinery',
      'lighting',
      'stairs',
      'landscape',
      'wet areas'
    ];
    
    this.materialCategories = [
      'stone',
      'tile',
      'wood',
      'cork',
      'concrete'
    ];
    
    this.archierSubfolders = [
      'complete',
      'wip'
    ];
  }

  /**
   * Generate folder path based on NEW tag logic
   * @param {Array} tags - Array of tags for the image
   * @param {string} baseFolder - Base SnapTag folder path
   * @returns {string} Complete folder path
   */
  generateFolderPath(tags = [], baseFolder = '/SnapTag') {
    console.log('📁 Generating folder path for tags:', tags);
    
    // Normalize tags to lowercase for comparison
    const normalizedTags = tags.map(tag => tag.toLowerCase().trim());
    
    // Step 1: Determine primary folder structure
    if (normalizedTags.includes('archier')) {
      // Archier project structure: /SnapTag/Archier/[Project Name]/[Complete|WIP]
      let folderPath = path.posix.join(baseFolder, 'Archier');
      
      // Look for project names (common ones for now, expandable)
      const projectNames = ['yandoit', 'ballarat', 'melbourne', 'brunswick'];
      let projectName = null;
      
      for (const project of projectNames) {
        if (normalizedTags.includes(project)) {
          projectName = this.toProperCase(project);
          break;
        }
      }
      
      if (projectName) {
        folderPath = path.posix.join(folderPath, projectName);
        
        // Determine Complete vs WIP
        if (normalizedTags.includes('complete')) {
          folderPath = path.posix.join(folderPath, 'Complete');
        } else if (normalizedTags.includes('wip')) {
          folderPath = path.posix.join(folderPath, 'WIP');
        }
        // If neither complete nor wip specified, default to project root
      } else {
        // No specific project, put in generic Archier folder
        // Could add default project handling here
      }
      
      console.log('✅ Archier folder path:', folderPath);
      return folderPath;
    }
    
    // Step 2: Check for Materials category
    for (const material of this.materialCategories) {
      if (normalizedTags.includes(material)) {
        const folderPath = path.posix.join(baseFolder, 'Materials', this.toProperCase(material));
        console.log('✅ Materials folder path:', folderPath);
        return folderPath;
      }
    }
    
    // Step 3: Default to Precedents with category subfolder
    let folderPath = path.posix.join(baseFolder, 'Precedents');
    
    // Determine category subfolder
    for (const category of this.precedentCategories) {
      if (normalizedTags.includes(category.toLowerCase())) {
        folderPath = path.posix.join(folderPath, this.toProperCase(category));
        console.log('📁 Precedents category folder:', this.toProperCase(category));
        break;
      }
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
   * Generate filename with sequential numbering instead of timestamps
   * @param {Array} tags - Array of tags
   * @param {string} originalExtension - Original file extension
   * @param {number} sequenceNumber - Sequential number for uniqueness
   * @returns {string} Generated filename
   */
  generateTagBasedFilename(tags = [], originalExtension = '.jpg', sequenceNumber = null) {
    console.log('🏷️ Generating tag-based filename for tags:', tags);
    
    // Normalize ALL tags (include ALL tags in filename)
    const normalizedTags = tags
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => tag.length > 0);
    
    // Convert tags to filename-safe format
    const filenameTags = normalizedTags
      .map(tag => tag.replace(/[^a-z0-9]/g, '-')) // Replace non-alphanumeric with hyphens
      .map(tag => tag.replace(/-+/g, '-')) // Replace multiple hyphens with single
      .map(tag => tag.replace(/^-|-$/g, '')) // Remove leading/trailing hyphens
      .filter(tag => tag.length > 0);
    
    // Create base filename with sequential number
    let filename;
    if (filenameTags.length > 0) {
      // Use ALL tags as filename
      const tagsString = filenameTags.join('-');
      
      // Add sequential number (5 digits with leading zeros)
      if (sequenceNumber !== null) {
        const paddedNumber = sequenceNumber.toString().padStart(5, '0');
        filename = `${paddedNumber}-${tagsString}`;
      } else {
        // Fallback to current date-based if no sequence provided
        const date = new Date();
        const shortTimestamp = 
          date.getFullYear().toString().slice(-2) +
          (date.getMonth() + 1).toString().padStart(2, '0') +
          date.getDate().toString().padStart(2, '0') + '-' +
          date.getHours().toString().padStart(2, '0') +
          date.getMinutes().toString().padStart(2, '0');
        filename = `${shortTimestamp}-${tagsString}`;
      }
    } else {
      // Fallback if no suitable tags
      if (sequenceNumber !== null) {
        filename = sequenceNumber.toString().padStart(5, '0') + '-image';
      } else {
        filename = 'image';
      }
    }
    
    // Ensure proper extension
    if (!originalExtension.startsWith('.')) {
      originalExtension = '.' + originalExtension;
    }
    
    const finalFilename = filename + originalExtension;
    console.log('✅ Generated filename:', finalFilename);
    
    return finalFilename;
  }

  /**
   * Get next sequence number for filename generation
   * @param {Object} databaseService - Database service instance
   * @returns {number} Next sequential number
   */
  async getNextSequenceNumber(databaseService) {
    try {
      // Get the highest current sequence number from existing filenames (PostgreSQL compatible)
      const result = await databaseService.query(`
        SELECT filename 
        FROM images 
        WHERE filename ~ '^[0-9]{5}-'
        ORDER BY filename DESC 
        LIMIT 1
      `);
      
      if (result.rows && result.rows.length > 0) {
        const latestFilename = result.rows[0].filename;
        const match = latestFilename.match(/^(\d{5})-/);
        if (match) {
          return parseInt(match[1]) + 1;
        }
      }
      
      // Start from 1 if no existing numbered files
      return 1;
    } catch (error) {
      console.error('Error getting next sequence number:', error);
      // Fallback to timestamp-based if sequence fails
      return null;
    }
  }

  /**
   * Get all possible folder paths for the NEW structure
   * @param {string} baseFolder - Base SnapTag folder path
   * @returns {Array} Array of all possible folder paths
   */
  getAllFolderPaths(baseFolder = '/SnapTag') {
    const paths = [];
    
    // Archier paths (with common projects - expandable)
    const archierBase = path.posix.join(baseFolder, 'Archier');
    paths.push(archierBase);
    
    const commonProjects = ['Yandoit', 'Ballarat', 'Melbourne', 'Brunswick'];
    for (const project of commonProjects) {
      const projectPath = path.posix.join(archierBase, project);
      paths.push(projectPath);
      paths.push(path.posix.join(projectPath, 'Complete'));
      paths.push(path.posix.join(projectPath, 'WIP'));
    }
    
    // Precedents paths
    const precedentsBase = path.posix.join(baseFolder, 'Precedents');
    paths.push(precedentsBase);
    
    for (const category of this.precedentCategories) {
      paths.push(path.posix.join(precedentsBase, this.toProperCase(category)));
    }
    
    // Materials paths
    const materialsBase = path.posix.join(baseFolder, 'Materials');
    paths.push(materialsBase);
    
    for (const material of this.materialCategories) {
      paths.push(path.posix.join(materialsBase, this.toProperCase(material)));
    }
    
    return paths;
  }
}

module.exports = FolderPathService; 