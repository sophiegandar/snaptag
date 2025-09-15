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
      'interiors',
      'joinery',
      'kitchens',
      'landscape',
      'lighting',
      'spatial',
      'stairs',
      'structure'
      // Note: 'general' is not included - it's the automatic fallback
    ];
    
    this.materialCategories = [
      'brick',
      'carpet', 
      'concrete',
      'fabric',
      'landscape',
      'metal',
      'stone',
      'tile',
      'wood'
      // Note: 'general' is not included - it's the automatic fallback
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
   * @returns {string} Single folder path (first matching tag wins)
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
        // Legacy city names
        'yandoit', 'ballarat', 'melbourne', 'brunswick', 'geelong', 
        'sydney', 'adelaide', 'perth', 'canberra', 'hobart',
        'bendigo', 'shepparton', 'warrnambool', 'mildura',
        // Current Archier projects
        'taroona house', 'taroona',
        'the boulevard', 'boulevard',
        'five yards house', 'five yards',
        'hampden road house', 'hampden road',
        'davison street',
        'yandoit house',
        'oakover preston',
        'corner house',
        'parks victoria',
        'caroma',
        'off grid house', 'off grid',
        'farm house',
        'view house',
        'court house',
        'casa acton',
        'harry house',
        'willisdene house',
        'julius street',
        'yagiz',
        'creative spaces'
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
    
    // Step 2: Check for Texture category (if "texture" tag OR any material category tag exists)
    if (normalizedTags.includes('texture') || normalizedTags.some(tag => this.materialCategories.includes(tag))) {
      console.log('🏷️ Texture classification: explicit texture tag OR material category tag found');
      
      // Look for specific material category
      for (const tag of normalizedTags) {
        if (this.materialCategories.includes(tag)) {
          const folderPath = path.posix.join(baseFolder, 'Texture', this.toProperCase(tag));
          console.log('✅ Texture with material category:', tag, '-> folder:', folderPath);
          return folderPath;
        }
      }
      
      // Texture classification but no specific material category, use Texture/General
      const generalTexturePath = path.posix.join(baseFolder, 'Texture', 'General');
      console.log('📁 Texture classification but no specific material category, using Texture/General:', generalTexturePath);
      return generalTexturePath;
    }
    
    // Step 3: Check for Precedent category (explicit precedent tag OR default fallback)
    console.log('📂 Processing as Precedent (not Archier or Texture)');
    const basePrecedentPath = path.posix.join(baseFolder, 'Precedent');
    
    // Find first matching precedent category in tag order
    console.log('🔍 Looking for precedent categories in tag order:', normalizedTags);
    console.log('🔍 Available categories:', this.precedentCategories);
    
    for (const tag of normalizedTags) {
      if (this.precedentCategories.includes(tag)) {
        const categoryPath = path.posix.join(basePrecedentPath, this.toProperCase(tag));
        console.log('✅ First matching precedent category:', tag, '-> folder:', categoryPath);
        return categoryPath;
      }
    }
    
    // If no specific categories found, automatically use Precedent/General
    const generalPath = path.posix.join(basePrecedentPath, 'General');
    console.log('📁 No specific precedent categories found, using automatic Precedent/General folder:', generalPath);
    return generalPath;
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
   * Convert sequence number to letter format: 
   * 1-9999 -> AA, 10000-19999 -> AB, 20000-29999 -> AC, etc.
   */
  getLetterSequence(sequenceNumber) {
    if (sequenceNumber < 1) return 'AA';
    
    // Determine which 9999-image group we're in
    const groupIndex = Math.floor((sequenceNumber - 1) / 9999);
    
    // Convert group index to double letters: 0->AA, 1->AB, 2->AC, etc.
    const firstLetter = 'A';
    const secondLetter = String.fromCharCode(65 + groupIndex); // A, B, C, D...
    
    return firstLetter + secondLetter;
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
    
    // Determine filename structure: AXXXX-Type-Category
    // Types: Archier, Precedent, Texture (only these 3)
    let filenameStructure = '';
    
    if (normalizedTags.includes('archier')) {
      // TYPE: Archier
      filenameStructure = 'archier';
      
      // CATEGORY: Find project name
      const projectNames = [
        'yandoit', 'ballarat', 'melbourne', 'brunswick', 'geelong', 
        'sydney', 'adelaide', 'perth', 'canberra', 'hobart',
        'bendigo', 'shepparton', 'warrnambool', 'mildura'
      ];
      
      let categoryFound = false;
      for (const project of projectNames) {
        if (normalizedTags.includes(project)) {
          filenameStructure += '-' + cleanTag(project);
          categoryFound = true;
          break;
        }
      }
      
      // Fallback category if no project found
      if (!categoryFound) {
        filenameStructure += '-general';
      }
      
    } else if (normalizedTags.includes('texture') || normalizedTags.some(tag => this.materialCategories.includes(tag))) {
      // TYPE: Texture (if has 'texture' tag OR any material category tag)
      filenameStructure = 'texture';
      
      // CATEGORY: Find material category
      let categoryFound = false;
      for (const material of this.materialCategories) {
        if (normalizedTags.includes(material)) {
          filenameStructure += '-' + cleanTag(material);
          categoryFound = true;
          break;
        }
      }
      
      // Fallback category if no material found
      if (!categoryFound) {
        filenameStructure += '-general';
      }
      
    } else {
      // TYPE: Precedent (default for everything else)
      filenameStructure = 'precedent';
      
      // CATEGORY: Find precedent category
      let categoryFound = false;
      for (const category of this.precedentCategories) {
        if (normalizedTags.includes(category)) {
          filenameStructure += '-' + cleanTag(category);
          categoryFound = true;
          break;
        }
      }
      
      // Fallback category if no precedent category found
      if (!categoryFound) {
        filenameStructure += '-general';
      }
    }
    
    // Add sequential number with AA prefix (double letter format)
    let filename;
    if (sequenceNumber !== null) {
      // Convert sequence number to AA, AB, AC... format
      const letterPart = this.getLetterSequence(sequenceNumber);
      
      // Calculate the number within the current letter group (1-9999)
      const numberInGroup = ((sequenceNumber - 1) % 9999) + 1;
      const paddedNumber = numberInGroup.toString().padStart(4, '0');
      
      filename = `${letterPart}-${paddedNumber}-${filenameStructure}`;
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
      // Look for AA-XXXX format (preferred) and fallback to legacy A-XXXX format
      const result = await databaseService.query(`
        SELECT filename 
        FROM images 
        WHERE filename ~ '^[A-Z]{1,2}[0-9]{4}-'
        ORDER BY filename DESC 
        LIMIT 1
      `);
      
      if (result.rows && result.rows.length > 0) {
        const latestFilename = result.rows[0].filename;
        console.log('🔍 Latest filename found:', latestFilename);
        
        // Try AA-XXXX format first (new format)
        let match = latestFilename.match(/^[A-Z]{2}(\d{4})-/);
        if (match) {
          console.log('📋 Found AA-XXXX format, sequence:', match[1]);
          return parseInt(match[1]) + 1;
        }
        
        // Fallback to A-XXXX format 
        match = latestFilename.match(/^[A-Z](\d{4})-/);
        if (match) {
          console.log('📋 Found A-XXXX format, sequence:', match[1]);
          return parseInt(match[1]) + 1;
        }
        
        // Fallback to legacy XXXX format
        match = latestFilename.match(/^(\d{4,5})-/);
        if (match) {
          console.log('📋 Found legacy XXXX format, sequence:', match[1]);
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
      // Legacy city names
      'Yandoit', 'Ballarat', 'Melbourne', 'Brunswick', 'Geelong',
      'Sydney', 'Adelaide', 'Perth', 'Canberra', 'Hobart',
      'Bendigo', 'Shepparton', 'Warrnambool', 'Mildura',
      // Current Archier projects
      'Taroona House', 'The Boulevard', 'Five Yards House', 'Hampden Road House',
      'Davison Street', 'Yandoit House', 'Oakover Preston', 'Corner House',
      'Parks Victoria', 'Caroma', 'Off Grid House', 'Farm House',
      'View House', 'Court House', 'Casa Acton', 'Harry House',
      'Willisdene House', 'Julius Street', 'Yagiz', 'Creative Spaces'
    ];
    
    for (const project of projectNames) {
      const projectPath = path.posix.join(archierBase, project);
      paths.push(projectPath);
      paths.push(path.posix.join(projectPath, 'Final'));
      paths.push(path.posix.join(projectPath, 'WIP'));
    }
    
    // Precedent paths
    const precedentBase = path.posix.join(baseFolder, 'Precedent');
    paths.push(precedentBase);
    paths.push(path.posix.join(precedentBase, 'General')); // Add General subfolder
    
    for (const category of this.precedentCategories) {
      paths.push(path.posix.join(precedentBase, this.toProperCase(category)));
    }
    
    // Texture paths
    const textureBase = path.posix.join(baseFolder, 'Texture');
    paths.push(textureBase);
    paths.push(path.posix.join(textureBase, 'General')); // Add General subfolder
    
    for (const material of this.materialCategories) {
      paths.push(path.posix.join(textureBase, this.toProperCase(material)));
    }
    
    return paths;
  }
}

module.exports = FolderPathService; 