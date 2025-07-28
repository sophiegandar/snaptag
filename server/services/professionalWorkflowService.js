const path = require('path');
const fs = require('fs').promises;
const metadataService = require('./metadataService');

class ProfessionalWorkflowService {
  constructor() {
    // Professional software requirements
    this.indesignOptimal = {
      formats: ['.jpg', '.jpeg', '.tiff', '.psd', '.eps'],
      minResolution: 300, // DPI for print
      maxFileSize: 50 * 1024 * 1024, // 50MB
      colorProfiles: ['sRGB', 'Adobe RGB', 'CMYK']
    };

    this.archicadOptimal = {
      formats: ['.jpg', '.jpeg', '.png', '.tiff', '.bmp'],
      maxResolution: 2048, // ArchiCAD texture limit
      preferredAspectRatios: ['1:1', '2:1', '4:3', '16:9'],
      maxFileSize: 10 * 1024 * 1024 // 10MB for textures
    };

    // Professional naming patterns
    this.professionalNaming = {
      project: /^[A-Z]{2,4}-\d{3,4}/, // e.g., YAN-001, ACTO-1234
      phase: /(concept|design|development|construction|built)/i,
      discipline: /(arch|struct|mep|landscape|interior)/i,
      drawing: /(plan|section|elevation|detail|perspective|axon)/i,
      scale: /@\d+:\d+/, // e.g., @1:100
      revision: /rev[A-Z\d]/i // e.g., revA, rev01
    };
  }

  /**
   * Optimize image for InDesign workflow
   */
  async optimizeForInDesign(imagePath, options = {}) {
    console.log('🎨 Optimizing image for InDesign workflow...');
    
    try {
      const {
        targetDPI = 300,
        colorProfile = 'sRGB',
        quality = 90,
        preserveOriginal = true,
        imageData = null
      } = options;

      const analysis = await this.analyzeImageForPrint(imagePath, imageData);
      const recommendations = [];

      // Check format compatibility
      const ext = path.extname(imagePath).toLowerCase();
      if (!this.indesignOptimal.formats.includes(ext)) {
        recommendations.push({
          type: 'format',
          issue: `Format ${ext} not optimal for InDesign`,
          suggestion: 'Convert to JPEG or TIFF for best compatibility',
          severity: 'medium'
        });
      }

      // Check resolution
      if (analysis.dpi && analysis.dpi < this.indesignOptimal.minResolution) {
        recommendations.push({
          type: 'resolution',
          issue: `Resolution ${analysis.dpi}dpi too low for print`,
          suggestion: `Increase to ${targetDPI}dpi minimum`,
          severity: 'high'
        });
      }

      // Check file size
      if (analysis.fileSize > this.indesignOptimal.maxFileSize) {
        recommendations.push({
          type: 'filesize',
          issue: `File size ${this.formatFileSize(analysis.fileSize)} may be too large`,
          suggestion: 'Consider optimizing compression or dimensions',
          severity: 'medium'
        });
      }

      // Generate optimized version if needed
      let optimizedPath = imagePath;
      if (recommendations.some(r => r.severity === 'high')) {
        optimizedPath = await this.generateOptimizedVersion(imagePath, {
          workflow: 'indesign',
          targetDPI,
          quality,
          colorProfile
        });
      }

      return {
        originalPath: imagePath,
        optimizedPath: optimizedPath,
        analysis: analysis,
        recommendations: recommendations,
        workflow: 'indesign',
        readyForProduction: recommendations.filter(r => r.severity === 'high').length === 0
      };

    } catch (error) {
      console.error('❌ Error optimizing for InDesign:', error);
      throw error;
    }
  }

  /**
   * Optimize image for ArchiCAD workflow
   */
  async optimizeForArchiCAD(imagePath, options = {}) {
    console.log('🏗️ Optimizing image for ArchiCAD workflow...');
    
    try {
      const {
        maxDimensions = 2048,
        textureOptimization = true,
        aspectRatioCorrection = false,
        imageData = null
      } = options;

      const analysis = await this.analyzeImageForCAD(imagePath, imageData);
      const recommendations = [];

      // Check format compatibility
      const ext = path.extname(imagePath).toLowerCase();
      if (!this.archicadOptimal.formats.includes(ext)) {
        recommendations.push({
          type: 'format',
          issue: `Format ${ext} not optimal for ArchiCAD`,
          suggestion: 'Convert to JPEG or PNG for best compatibility',
          severity: 'medium'
        });
      }

      // Check dimensions for texture use
      if (analysis.width > this.archicadOptimal.maxResolution || 
          analysis.height > this.archicadOptimal.maxResolution) {
        recommendations.push({
          type: 'dimensions',
          issue: `Dimensions ${analysis.width}x${analysis.height} too large for ArchiCAD textures`,
          suggestion: `Resize to max ${maxDimensions}px`,
          severity: 'high'
        });
      }

      // Check aspect ratio for architectural use
      const aspectRatio = this.calculateAspectRatio(analysis.width, analysis.height);
      if (textureOptimization && !this.isOptimalAspectRatio(aspectRatio)) {
        recommendations.push({
          type: 'aspect',
          issue: `Aspect ratio ${aspectRatio} not optimal for architectural textures`,
          suggestion: 'Consider cropping to 1:1, 2:1, or 4:3 ratio',
          severity: 'low'
        });
      }

      // Check file size for performance
      if (analysis.fileSize > this.archicadOptimal.maxFileSize) {
        recommendations.push({
          type: 'filesize',
          issue: `File size ${this.formatFileSize(analysis.fileSize)} may impact ArchiCAD performance`,
          suggestion: 'Optimize for smaller file size',
          severity: 'medium'
        });
      }

      // Generate optimized version if needed
      let optimizedPath = imagePath;
      if (recommendations.some(r => r.severity === 'high')) {
        optimizedPath = await this.generateOptimizedVersion(imagePath, {
          workflow: 'archicad',
          maxDimensions,
          aspectRatioCorrection
        });
      }

      return {
        originalPath: imagePath,
        optimizedPath: optimizedPath,
        analysis: analysis,
        recommendations: recommendations,
        workflow: 'archicad',
        readyForProduction: recommendations.filter(r => r.severity === 'high').length === 0
      };

    } catch (error) {
      console.error('❌ Error optimizing for ArchiCAD:', error);
      throw error;
    }
  }

  /**
   * Analyze image suitability for print workflows (simplified - uses DB metadata)
   */
  async analyzeImageForPrint(imagePath, imageData = null) {
    try {
      // If we have image data from DB, use that instead of downloading
      if (imageData) {
        return {
          fileSize: imageData.file_size || 0,
          width: imageData.width || null,
          height: imageData.height || null,
          dpi: null, // Would need to extract from file
          colorSpace: 'unknown',
          format: path.extname(imageData.filename || imagePath).toLowerCase(),
          hasColorProfile: false,
          bitDepth: null,
          compression: null,
          isSimulated: true
        };
      }

      // Fallback to file analysis if no DB data
      try {
        const stats = await fs.stat(imagePath);
        const metadata = await metadataService.readMetadata(imagePath);
        
        return {
          fileSize: stats.size,
          width: metadata.width || null,
          height: metadata.height || null,
          dpi: metadata.dpi || metadata.resolution || null,
          colorSpace: metadata.colorSpace || 'unknown',
          format: path.extname(imagePath).toLowerCase(),
          hasColorProfile: !!metadata.colorProfile,
          bitDepth: metadata.bitDepth || null,
          compression: metadata.compression || null
        };
      } catch (error) {
        console.error('Error analyzing image file:', error);
        return { fileSize: 0, error: error.message };
      }
    } catch (error) {
      console.error('Error analyzing image for print:', error);
      return { fileSize: 0, error: error.message };
    }
  }

  /**
   * Analyze image suitability for CAD workflows (simplified - uses DB metadata)
   */
  async analyzeImageForCAD(imagePath, imageData = null) {
    try {
      // If we have image data from DB, use that instead of downloading
      if (imageData) {
        const width = imageData.width || 0;
        const height = imageData.height || 0;
        const aspectRatio = this.calculateAspectRatio(width, height);
        
        return {
          fileSize: imageData.file_size || 0,
          width: width,
          height: height,
          aspectRatio: aspectRatio,
          format: path.extname(imageData.filename || imagePath).toLowerCase(),
          isPowerOfTwo: this.isPowerOfTwo(width) && this.isPowerOfTwo(height),
          isSquare: width === height,
          pixelDensity: width * height,
          isSimulated: true
        };
      }

      // Fallback to file analysis if no DB data
      try {
        const stats = await fs.stat(imagePath);
        const metadata = await metadataService.readMetadata(imagePath);
        
        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const aspectRatio = this.calculateAspectRatio(width, height);
        
        return {
          fileSize: stats.size,
          width: width,
          height: height,
          aspectRatio: aspectRatio,
          format: path.extname(imagePath).toLowerCase(),
          isPowerOfTwo: this.isPowerOfTwo(width) && this.isPowerOfTwo(height),
          isSquare: width === height,
          pixelDensity: width * height
        };
      } catch (error) {
        console.error('Error analyzing image file:', error);
        return { fileSize: 0, error: error.message };
      }
    } catch (error) {
      console.error('Error analyzing image for CAD:', error);
      return { fileSize: 0, error: error.message };
    }
  }

  /**
   * Generate professional filename following architectural conventions
   */
  generateProfessionalFilename(metadata, options = {}) {
    const {
      projectCode,
      phase = 'design',
      discipline = 'arch',
      drawingType,
      scale,
      revision = 'A'
    } = options;

    const components = [];
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Project code (if provided)
    if (projectCode) {
      components.push(projectCode.toUpperCase());
    }

    // Phase
    if (phase) {
      components.push(phase.toLowerCase());
    }

    // Discipline
    if (discipline) {
      components.push(discipline.toLowerCase());
    }

    // Drawing type (from content analysis)
    const contentType = this.detectDrawingType(metadata);
    if (drawingType || contentType) {
      components.push((drawingType || contentType).toLowerCase());
    }

    // Scale (if applicable)
    if (scale) {
      components.push(`scale-${scale.replace(':', '')}`);
    }

    // Revision
    if (revision) {
      components.push(`rev${revision}`);
    }

    // Date
    components.push(date);

    const extension = metadata.originalName ? 
      path.extname(metadata.originalName) : '.jpg';

    return `${components.join('-')}${extension}`;
  }

  /**
   * Detect drawing type from image content and metadata
   */
  detectDrawingType(metadata) {
    const { title = '', description = '', tags = [], filename = '' } = metadata;
    const text = [title, description, filename, ...tags].join(' ').toLowerCase();

    // Check for drawing types
    if (text.includes('plan') || text.includes('floor')) return 'plan';
    if (text.includes('section')) return 'section';
    if (text.includes('elevation')) return 'elevation';
    if (text.includes('detail')) return 'detail';
    if (text.includes('perspective') || text.includes('render')) return 'perspective';
    if (text.includes('axon') || text.includes('isometric')) return 'axon';
    if (text.includes('exterior') || text.includes('facade')) return 'exterior';
    if (text.includes('interior')) return 'interior';
    if (text.includes('site') || text.includes('context')) return 'site';
    if (text.includes('construction') || text.includes('detail')) return 'construction';

    return 'image'; // fallback
  }

  /**
   * Calculate aspect ratio as string
   */
  calculateAspectRatio(width, height) {
    if (!width || !height) return '0:0';
    
    const gcd = this.greatestCommonDivisor(width, height);
    const ratioW = width / gcd;
    const ratioH = height / gcd;
    
    return `${ratioW}:${ratioH}`;
  }

  /**
   * Check if aspect ratio is optimal for architectural use
   */
  isOptimalAspectRatio(aspectRatio) {
    const optimal = ['1:1', '2:1', '3:2', '4:3', '16:9', '16:10'];
    return optimal.includes(aspectRatio);
  }

  /**
   * Check if number is power of 2 (optimal for textures)
   */
  isPowerOfTwo(n) {
    return n && (n & (n - 1)) === 0;
  }

  /**
   * Greatest common divisor helper
   */
  greatestCommonDivisor(a, b) {
    return b === 0 ? a : this.greatestCommonDivisor(b, a % b);
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Generate optimized version (placeholder - would use image processing library)
   */
  async generateOptimizedVersion(imagePath, options = {}) {
    // In a real implementation, this would use sharp, imagemagick, or similar
    // For now, return original path with note
    console.log(`📸 Would optimize ${imagePath} for ${options.workflow}`);
    console.log(`   Options:`, options);
    
    // Return original path for now - actual optimization would require image processing library
    return imagePath;
  }

  /**
   * Generate workflow report for team sharing
   */
  generateWorkflowReport(optimizations = []) {
    const report = {
      timestamp: new Date().toISOString(),
      totalImages: optimizations.length,
      readyForInDesign: 0,
      readyForArchiCAD: 0,
      recommendationsCount: 0,
      commonIssues: {},
      summary: ''
    };

    optimizations.forEach(opt => {
      if (opt.workflow === 'indesign' && opt.readyForProduction) {
        report.readyForInDesign++;
      }
      if (opt.workflow === 'archicad' && opt.readyForProduction) {
        report.readyForArchiCAD++;
      }
      
      report.recommendationsCount += opt.recommendations.length;
      
      opt.recommendations.forEach(rec => {
        if (!report.commonIssues[rec.type]) {
          report.commonIssues[rec.type] = 0;
        }
        report.commonIssues[rec.type]++;
      });
    });

    // Generate summary
    const issues = Object.keys(report.commonIssues);
    if (issues.length === 0) {
      report.summary = 'All images are optimized for professional workflows! 🎉';
    } else {
      const topIssue = issues.reduce((a, b) => 
        report.commonIssues[a] > report.commonIssues[b] ? a : b
      );
      report.summary = `Most common optimization needed: ${topIssue} (${report.commonIssues[topIssue]} images)`;
    }

    return report;
  }
}

module.exports = new ProfessionalWorkflowService(); 