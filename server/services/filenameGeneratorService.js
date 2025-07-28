const path = require('path');
const url = require('url');

class FilenameGeneratorService {
  constructor() {
    // Common architecture/design domains for specialized naming
    this.architectureDomains = [
      'archier.com.au', 'archdaily.com', 'dezeen.com', 'inhabitat.com',
      'curbed.com', 'architecturaldigest.com', 'dwell.com', 'architectural-review.com',
      'worldarchitecture.org', 'architizer.com', 'designboom.com', 'plataformaarquitectura.cl'
    ];

    // Common image content patterns
    this.contentPatterns = {
      exterior: ['exterior', 'facade', 'building', 'front', 'street', 'outdoor'],
      interior: ['interior', 'room', 'living', 'kitchen', 'bedroom', 'bathroom', 'indoor'],
      detail: ['detail', 'close-up', 'texture', 'material', 'finish'],
      plan: ['plan', 'floor', 'blueprint', 'drawing', 'sketch', 'section'],
      construction: ['construction', 'build', 'site', 'progress', 'work'],
      landscape: ['garden', 'landscape', 'yard', 'outdoor', 'patio', 'terrace']
    };

    // File size categories for naming
    this.sizeCategories = {
      thumbnail: { max: 50000, suffix: 'thumb' },
      small: { max: 200000, suffix: 'sm' },
      medium: { max: 1000000, suffix: 'md' },
      large: { max: 5000000, suffix: 'lg' },
      xlarge: { max: Infinity, suffix: 'xl' }
    };
  }

  /**
   * Generate a smart filename based on image metadata and context
   */
  async generateFilename(options = {}) {
    const {
      originalName,
      sourceUrl,
      title,
      description,
      tags = [],
      fileSize,
      width,
      height,
      existingFilenames = []
    } = options;

    console.log('🔧 Generating smart filename for:', { originalName, sourceUrl, title });

    try {
      // Build filename components
      const components = [];

      // 1. Date component (YYYY-MM-DD format)
      const dateStr = this.getDateComponent();
      components.push(dateStr);

      // 2. Source/domain component
      const sourceComponent = this.getSourceComponent(sourceUrl);
      if (sourceComponent) {
        components.push(sourceComponent);
      }

      // 3. Content/context component
      const contentComponent = this.getContentComponent({ title, description, tags, originalName });
      if (contentComponent) {
        components.push(contentComponent);
      }

      // 4. Size/dimension component (for large images)
      const sizeComponent = this.getSizeComponent({ width, height, fileSize });
      if (sizeComponent) {
        components.push(sizeComponent);
      }

      // 5. Get file extension
      const extension = this.getFileExtension(originalName);

      // Construct base filename
      let baseFilename = components.join('-');
      
      // Clean up the filename
      baseFilename = this.cleanFilename(baseFilename);
      
      // Ensure it's not too long (max 100 chars before extension)
      if (baseFilename.length > 100) {
        baseFilename = baseFilename.substring(0, 100);
      }

      // Add extension
      let finalFilename = `${baseFilename}${extension}`;

      // Handle duplicates
      finalFilename = this.handleDuplicates(finalFilename, existingFilenames);

      console.log('✅ Generated filename:', finalFilename);
      return finalFilename;

    } catch (error) {
      console.error('❌ Error generating smart filename:', error);
      // Fallback to timestamp-based naming
      return this.generateFallbackFilename(originalName);
    }
  }

  /**
   * Generate date component (YYYY-MM-DD)
   */
  getDateComponent() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Extract and clean source component from URL
   */
  getSourceComponent(sourceUrl) {
    if (!sourceUrl) return null;

    try {
      const parsedUrl = new URL(sourceUrl);
      let domain = parsedUrl.hostname.toLowerCase();
      
      // Remove 'www.' prefix
      domain = domain.replace(/^www\./, '');
      
      // Extract meaningful part of domain
      const domainParts = domain.split('.');
      
      // Special handling for known architecture sites
      if (this.architectureDomains.includes(domain)) {
        if (domain.includes('archier')) return 'archier';
        if (domain.includes('archdaily')) return 'archdaily';
        if (domain.includes('dezeen')) return 'dezeen';
        if (domain.includes('inhabitat')) return 'inhabitat';
        if (domain.includes('curbed')) return 'curbed';
        if (domain.includes('dwell')) return 'dwell';
        return domainParts[0]; // First part of domain
      }

      // For other domains, use the main part
      if (domainParts.length >= 2) {
        return domainParts[0];
      }
      
      return domain;
    } catch (error) {
      console.warn('Could not parse source URL:', sourceUrl);
      return null;
    }
  }

  /**
   * Determine content type from title, description, and tags
   */
  getContentComponent(metadata) {
    const { title = '', description = '', tags = [], originalName = '' } = metadata;
    
    // Combine all text sources
    const allText = [title, description, originalName, ...tags]
      .join(' ')
      .toLowerCase();

    // Check for content patterns
    for (const [category, keywords] of Object.entries(this.contentPatterns)) {
      for (const keyword of keywords) {
        if (allText.includes(keyword)) {
          return category;
        }
      }
    }

    // Check for project/building names in title
    const titleWords = title.toLowerCase().split(/[\s\-_]+/);
    for (const word of titleWords) {
      if (word.length > 3 && !this.isCommonWord(word)) {
        return this.cleanString(word);
      }
    }

    // Check tags for meaningful content
    for (const tag of tags) {
      if (tag.length > 3 && !this.isCommonWord(tag.toLowerCase())) {
        return this.cleanString(tag);
      }
    }

    return 'image'; // Default fallback
  }

  /**
   * Generate size component for larger images
   */
  getSizeComponent({ width, height, fileSize }) {
    // Only add size component for larger images
    if (width && height && (width > 2000 || height > 2000)) {
      return `${width}x${height}`;
    }

    // Or for large file sizes
    if (fileSize) {
      for (const [category, config] of Object.entries(this.sizeCategories)) {
        if (fileSize <= config.max && category !== 'small' && category !== 'thumbnail') {
          return config.suffix;
        }
      }
    }

    return null;
  }

  /**
   * Get file extension from original filename
   */
  getFileExtension(originalName) {
    if (!originalName) return '.jpg'; // Default
    
    const ext = path.extname(originalName).toLowerCase();
    
    // Ensure valid image extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
    if (validExtensions.includes(ext)) {
      return ext;
    }
    
    return '.jpg'; // Default fallback
  }

  /**
   * Clean filename string
   */
  cleanFilename(filename) {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Clean a string for use in filename
   */
  cleanString(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20); // Limit length
  }

  /**
   * Check if word is common/generic
   */
  isCommonWord(word) {
    const commonWords = [
      'image', 'photo', 'picture', 'img', 'jpeg', 'jpg', 'png',
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between'
    ];
    return commonWords.includes(word);
  }

  /**
   * Handle filename duplicates by adding incremental suffix
   */
  handleDuplicates(filename, existingFilenames) {
    if (!existingFilenames.includes(filename)) {
      return filename;
    }

    const extension = path.extname(filename);
    const baseName = path.basename(filename, extension);
    
    let counter = 1;
    let newFilename;
    
    do {
      newFilename = `${baseName}-${counter}${extension}`;
      counter++;
    } while (existingFilenames.includes(newFilename));
    
    return newFilename;
  }

  /**
   * Fallback filename generation (timestamp-based)
   */
  generateFallbackFilename(originalName) {
    const timestamp = Date.now();
    const extension = this.getFileExtension(originalName);
    return `${timestamp}-image${extension}`;
  }

  /**
   * Generate filename specifically for batch operations
   */
  generateBatchFilename(index, total, baseContext = 'batch') {
    const dateStr = this.getDateComponent();
    const paddedIndex = String(index + 1).padStart(String(total).length, '0');
    return `${dateStr}-${baseContext}-${paddedIndex}.jpg`;
  }

  /**
   * Extract metadata from existing filename for analysis
   */
  analyzeFilename(filename) {
    const analysis = {
      hasDate: false,
      hasSource: false,
      hasContent: false,
      hasSize: false,
      category: 'unknown'
    };

    const cleanName = filename.toLowerCase();

    // Check for date pattern (YYYY-MM-DD)
    if (/\d{4}-\d{2}-\d{2}/.test(cleanName)) {
      analysis.hasDate = true;
    }

    // Check for known domains
    for (const domain of this.architectureDomains) {
      const domainKey = domain.split('.')[0];
      if (cleanName.includes(domainKey)) {
        analysis.hasSource = true;
        break;
      }
    }

    // Check for content categories
    for (const [category, keywords] of Object.entries(this.contentPatterns)) {
      for (const keyword of keywords) {
        if (cleanName.includes(keyword)) {
          analysis.hasContent = true;
          analysis.category = category;
          break;
        }
      }
      if (analysis.hasContent) break;
    }

    // Check for size indicators
    if (/\d{3,}x\d{3,}/.test(cleanName) || /(sm|md|lg|xl|thumb)/.test(cleanName)) {
      analysis.hasSize = true;
    }

    return analysis;
  }
}

module.exports = new FilenameGeneratorService(); 