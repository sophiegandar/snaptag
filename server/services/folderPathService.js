const path = require('path');

class FolderPathService {
  constructor() {
    // Define the EXACT folder structure as specified
    this.precedentCategories = [
      'art',
      'bathrooms',
      'details',
      'doors',
      'exterior',
      'exteriors',
      'furniture',
      'general',
      'interiors',
      'joinery',
      'kitchens',
      'landscape',
      'lighting',
      'spatial',
      'stairs',
      'structure'
    ];
    
    this.materialCategories = [
      'brick',
      'carpet',
      'concrete',
      'fabric',
      'general',
      'landscape',
      'metal',
      'stone',
      'tile',
      'wood'
    ];
    
    // Archier project structure: [Project Name]/[Final|WIP]
    this.archierSubfolders = [
      'final',
      'wip'
    ];
  }

  /**
   * Generate folder path based on EXACT tag logic matching the provided structure
   * @param {Array} tags - Array of tags for the image
   * @param {string} baseFolder - Base SnapTag folder path
   * @returns {string} Complete folder path
   */
  generateFolderPath(tags = [], baseFolder = '/SnapTag') {
    console.log('📁 Generating folder path for tags:', tags);
    console.log('📁 Base folder:', baseFolder);
    
    // Normalize tags to lowercase for comparison
    const normalizedTags = tags.map(tag => tag.toLowerCase().trim());
    console.log('📁 Normalized tags:', normalizedTags);
    
    // Step 1: Check for Archier project structure
    if (normalizedTags.includes('archier')) {
      console.log('🏗️ Processing as Archier project');
      // Archier project structure: /SnapTag/Archier/[Project Name]/[Final|WIP]
      let folderPath = path.posix.join(baseFolder, 'Archier');
      
      // Look for project names (expandable list)
      const projectNames = [
        'yandoit', 'ballarat', 'melbourne', 'brunswick', 'geelong', 
        'sydney', 'adelaide', 'perth', 'canberra', 'hobart',
        'bendigo', 'shepparton', 'warrnambool', 'mildura'
      ];
      
      let projectName = null;
      for (const project of projectNames) {
        if (normalizedTags.includes(project)) {
          projectName = this.toProperCase(project);
          break;
        }
      }
      
      if (projectName) {
        folderPath = path.posix.join(folderPath, projectName);
        
        // Determine Final vs WIP (changed from Complete to Final)
        if (normalizedTags.includes('final') || normalizedTags.includes('complete')) {
          folderPath = path.posix.join(folderPath, 'Final');
        } else if (normalizedTags.includes('wip')) {
          folderPath = path.posix.join(folderPath, 'WIP');
        }
        // If neither final nor wip specified, default to project root
      } else {
        // No specific project, put in generic Archier folder
        console.log('⚠️ Archier tag found but no specific project name detected');
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
    console.log('📂 Processing as Precedents (not Archier or Materials)');
    let folderPath = path.posix.join(baseFolder, 'Precedents');
    
    // Determine category subfolder
    console.log('🔍 Looking for precedent category in:', normalizedTags);
    console.log('🔍 Available categories:', this.precedentCategories);
    
    for (const category of this.precedentCategories) {
      console.log(`🔍 Checking if tags include "${category.toLowerCase()}"`);
      if (normalizedTags.includes(category.toLowerCase())) {
        folderPath = path.posix.join(folderPath, this.toProperCase(category));
        console.log('✅ Found category match:', category, '-> folder:', this.toProperCase(category));
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
   * Generate filename with logical structure: XXXX-category-specifictag
   * @param {Array} tags - Array of tags
   * @param {string} originalExtension - Original file extension
   * @param {number} sequenceNumber - Sequential number for uniqueness
   * @returns {string} Generated filename
   */
  generateTagBasedFilename(tags = [], originalExtension = '.jpg', sequenceNumber = null) {
    console.log('🏷️ Generating tag-based filename for tags:', tags);
    
    // Normalize tags for processing
    const normalizedTags = tags
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => tag.length > 0);
    
    // Helper function to clean tag for filename
    const cleanTag = (tag) => {
      return tag
        .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    };
    
    // Determine filename structure based on folder logic
    let filenameStructure = '';
    
    if (normalizedTags.includes('archier')) {
      // XXXX-archier-projectname format
      filenameStructure = 'archier';
      
      // Find project name
      const projectNames = [
        'yandoit', 'ballarat', 'melbourne', 'brunswick', 'geelong', 
        'sydney', 'adelaide', 'perth', 'canberra', 'hobart',
        'bendigo', 'shepparton', 'warrnambool', 'mildura'
      ];
      
      for (const project of projectNames) {
        if (normalizedTags.includes(project)) {
          filenameStructure += '-' + cleanTag(project);
          break;
        }
      }
      
      // Add final/wip if present
      if (normalizedTags.includes('final')) {
        filenameStructure += '-final';
      } else if (normalizedTags.includes('wip')) {
        filenameStructure += '-wip';
      }
      
    } else {
      // Check if it's materials
      let isMaterial = false;
      for (const material of this.materialCategories) {
        if (normalizedTags.includes(material)) {
          filenameStructure = 'materials-' + cleanTag(material);
          isMaterial = true;
          break;
        }
      }
      
      if (!isMaterial) {
        // Default to precedents with category
        filenameStructure = 'precedents';
        
        // Find the most specific category tag
        for (const category of this.precedentCategories) {
          if (normalizedTags.includes(category)) {
            filenameStructure += '-' + cleanTag(category);
            break;
          }
        }
        
        // If no category found, add first non-structural tag
        if (filenameStructure === 'precedents') {
          const structuralTags = ['archier', 'final', 'complete', 'wip', ...this.precedentCategories, ...this.materialCategories];
          const specificTag = normalizedTags.find(tag => !structuralTags.includes(tag));
          if (specificTag) {
            filenameStructure += '-' + cleanTag(specificTag);
          }
        }
      }
    }
    
    // Add sequential number
    let filename;
    if (sequenceNumber !== null) {
      const paddedNumber = sequenceNumber.toString().padStart(4, '0');
      filename = `${paddedNumber}-${filenameStructure}`;
    } else {
      // Fallback to date-based if no sequence provided
      const date = new Date();
      const shortTimestamp = 
        date.getFullYear().toString().slice(-2) +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0') + '-' +
        date.getHours().toString().padStart(2, '0') +
        date.getMinutes().toString().padStart(2, '0');
      filename = `${shortTimestamp}-${filenameStructure}`;
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
      // Look for both 4-digit and 5-digit patterns for backward compatibility
      const result = await databaseService.query(`
        SELECT filename 
        FROM images 
        WHERE filename ~ '^[0-9]{4,5}-'
        ORDER BY filename DESC 
        LIMIT 1
      `);
      
      if (result.rows && result.rows.length > 0) {
        const latestFilename = result.rows[0].filename;
        const match = latestFilename.match(/^(\d{4,5})-/);
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
   * Get all possible folder paths for the EXACT structure
   * @param {string} baseFolder - Base SnapTag folder path
   * @returns {Array} Array of all possible folder paths
   */
  getAllFolderPaths(baseFolder = '/SnapTag') {
    const paths = [];
    
    // Archier paths (with expandable projects list)
    const archierBase = path.posix.join(baseFolder, 'Archier');
    paths.push(archierBase);
    
    const projectNames = [
      'Yandoit', 'Ballarat', 'Melbourne', 'Brunswick', 'Geelong',
      'Sydney', 'Adelaide', 'Perth', 'Canberra', 'Hobart',
      'Bendigo', 'Shepparton', 'Warrnambool', 'Mildura'
    ];
    
    for (const project of projectNames) {
      const projectPath = path.posix.join(archierBase, project);
      paths.push(projectPath);
      paths.push(path.posix.join(projectPath, 'Final'));
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