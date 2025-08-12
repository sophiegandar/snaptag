class TagSuggestionService {
  constructor(databaseService) {
    this.databaseService = databaseService;
  }

  /**
   * Generate tag suggestions for an untagged image
   * @param {Object} image - Image object with metadata
   * @returns {Array} Array of suggested tags with confidence scores
   */
  async generateSuggestions(image) {
    const suggestions = [];
    
    try {
      // 1. Source-based suggestions
      const sourceSuggestions = await this.getSuggestionsFromSource(image.source_url);
      suggestions.push(...sourceSuggestions);
      
      // 2. Filename-based suggestions  
      const filenameSuggestions = await this.getSuggestionsFromFilename(image.filename);
      suggestions.push(...filenameSuggestions);
      
      // 3. Description-based suggestions
      if (image.description) {
        const descriptionSuggestions = await this.getSuggestionsFromDescription(image.description);
        suggestions.push(...descriptionSuggestions);
      }
      
      // 4. Pattern-based suggestions from similar images
      const patternSuggestions = await this.getSuggestionsFromPatterns(image);
      suggestions.push(...patternSuggestions);
      
      // 5. Common tag combinations
      const combinationSuggestions = await this.getSuggestionsFromCombinations();
      suggestions.push(...combinationSuggestions);
      
      // Consolidate and rank suggestions
      return this.consolidateAndRankSuggestions(suggestions);
      
    } catch (error) {
      console.error('Error generating tag suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze source URL for tag suggestions
   */
  async getSuggestionsFromSource(sourceUrl) {
    const suggestions = [];
    
    if (!sourceUrl) return suggestions;
    
    try {
      // Get tags from images with similar sources
      const result = await this.databaseService.query(`
        SELECT t.name, COUNT(*) as frequency
        FROM images i
        JOIN image_tags it ON i.id = it.image_id
        JOIN tags t ON it.tag_id = t.id
        WHERE i.source_url LIKE $1
        GROUP BY t.name
        ORDER BY frequency DESC
        LIMIT 10
      `, [`%${this.extractDomain(sourceUrl)}%`]);
      
      result.rows.forEach(row => {
        suggestions.push({
          tag: row.name,
          confidence: Math.min(0.8, row.frequency * 0.1), // Cap at 80%
          reason: `Common in images from ${this.extractDomain(sourceUrl)}`
        });
      });
      
      // Check for specific architectural sites
      const domain = this.extractDomain(sourceUrl);
      if (domain.includes('architizer')) {
        suggestions.push({ tag: 'architecture', confidence: 0.9, reason: 'Architizer source' });
      } else if (domain.includes('dezeen')) {
        suggestions.push({ tag: 'design', confidence: 0.9, reason: 'Dezeen source' });
      } else if (domain.includes('archdaily')) {
        suggestions.push({ tag: 'architecture', confidence: 0.9, reason: 'ArchDaily source' });
      } else if (domain.includes('pinterest')) {
        suggestions.push({ tag: 'precedents', confidence: 0.7, reason: 'Pinterest source' });
      }
      
    } catch (error) {
      console.error('Error getting source suggestions:', error);
    }
    
    return suggestions;
  }

  /**
   * Analyze filename for tag suggestions
   */
  async getSuggestionsFromFilename(filename) {
    const suggestions = [];
    
    if (!filename) return suggestions;
    
    const cleanFilename = filename.toLowerCase()
      .replace(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i, '') // Remove extension
      .replace(/[^a-z0-9\s-]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // Look for keyword matches in existing tags
    try {
      const result = await this.databaseService.query(`
        SELECT name, COUNT(*) as usage_count
        FROM tags
        GROUP BY name
        ORDER BY usage_count DESC
      `);
      
      const existingTags = result.rows;
      
      // Check if filename contains any existing tags
      existingTags.forEach(tagRow => {
        const tagName = tagRow.name.toLowerCase();
        if (cleanFilename.includes(tagName) || tagName.includes(cleanFilename)) {
          suggestions.push({
            tag: tagRow.name,
            confidence: 0.8,
            reason: `Filename contains "${tagName}"`
          });
        }
      });
      
      // Check for architectural keywords
      const architecturalKeywords = {
        'facade': 0.9,
        'interior': 0.9,
        'exterior': 0.9,
        'bathroom': 0.9,
        'kitchen': 0.9,
        'stair': 0.8,
        'lighting': 0.8,
        'concrete': 0.8,
        'wood': 0.8,
        'metal': 0.8,
        'glass': 0.8,
        'brick': 0.8,
        'stone': 0.8,
        'landscape': 0.8,
        'joinery': 0.7,
        'detail': 0.7
      };
      
      Object.entries(architecturalKeywords).forEach(([keyword, confidence]) => {
        if (cleanFilename.includes(keyword)) {
          suggestions.push({
            tag: keyword,
            confidence: confidence,
            reason: `Filename contains "${keyword}"`
          });
        }
      });
      
    } catch (error) {
      console.error('Error getting filename suggestions:', error);
    }
    
    return suggestions;
  }

  /**
   * Analyze description for tag suggestions
   */
  async getSuggestionsFromDescription(description) {
    const suggestions = [];
    
    if (!description) return suggestions;
    
    const cleanDescription = description.toLowerCase();
    
    // Similar logic to filename analysis but for description text
    try {
      const result = await this.databaseService.query(`
        SELECT name, COUNT(*) as usage_count
        FROM tags
        GROUP BY name
        ORDER BY usage_count DESC
      `);
      
      const existingTags = result.rows;
      
      existingTags.forEach(tagRow => {
        const tagName = tagRow.name.toLowerCase();
        if (cleanDescription.includes(tagName)) {
          suggestions.push({
            tag: tagRow.name,
            confidence: 0.7,
            reason: `Description mentions "${tagName}"`
          });
        }
      });
      
    } catch (error) {
      console.error('Error getting description suggestions:', error);
    }
    
    return suggestions;
  }

  /**
   * Find patterns in similar images
   */
  async getSuggestionsFromPatterns(image) {
    const suggestions = [];
    
    try {
      // Find images from same source
      if (image.source_url) {
        const result = await this.databaseService.query(`
          SELECT t.name, COUNT(*) as frequency
          FROM images i
          JOIN image_tags it ON i.id = it.image_id
          JOIN tags t ON it.tag_id = t.id
          WHERE i.source_url = $1 AND i.id != $2
          GROUP BY t.name
          ORDER BY frequency DESC
          LIMIT 5
        `, [image.source_url, image.id]);
        
        result.rows.forEach(row => {
          suggestions.push({
            tag: row.name,
            confidence: Math.min(0.6, row.frequency * 0.2),
            reason: `Common in other images from same source`
          });
        });
      }
      
    } catch (error) {
      console.error('Error getting pattern suggestions:', error);
    }
    
    return suggestions;
  }

  /**
   * Suggest common tag combinations
   */
  async getSuggestionsFromCombinations() {
    const suggestions = [];
    
    try {
      // Find most common tags overall
      const result = await this.databaseService.query(`
        SELECT t.name, COUNT(*) as usage_count
        FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        GROUP BY t.name
        ORDER BY usage_count DESC
        LIMIT 5
      `);
      
      result.rows.forEach(row => {
        suggestions.push({
          tag: row.name,
          confidence: 0.3, // Low confidence for general suggestions
          reason: `Commonly used tag (${row.usage_count} times)`
        });
      });
      
    } catch (error) {
      console.error('Error getting combination suggestions:', error);
    }
    
    return suggestions;
  }

  /**
   * Consolidate and rank suggestions
   */
  consolidateAndRankSuggestions(suggestions) {
    // Group by tag name and combine confidence scores
    const tagMap = new Map();
    
    suggestions.forEach(suggestion => {
      const existing = tagMap.get(suggestion.tag);
      if (existing) {
        // Combine confidence scores (taking max and adding bonus for multiple sources)
        existing.confidence = Math.min(0.95, Math.max(existing.confidence, suggestion.confidence) + 0.1);
        existing.reasons.push(suggestion.reason);
      } else {
        tagMap.set(suggestion.tag, {
          tag: suggestion.tag,
          confidence: suggestion.confidence,
          reasons: [suggestion.reason]
        });
      }
    });
    
    // Convert to array and sort by confidence
    return Array.from(tagMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8) // Return top 8 suggestions
      .map(item => ({
        tag: item.tag,
        confidence: Math.round(item.confidence * 100),
        reason: item.reasons[0] // Show primary reason
      }));
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Get bulk suggestions for multiple images
   */
  async getBulkSuggestions(imageIds) {
    const suggestions = {};
    
    for (const imageId of imageIds) {
      try {
        const image = await this.databaseService.getImageById(imageId);
        if (image) {
          suggestions[imageId] = await this.generateSuggestions(image);
        }
      } catch (error) {
        console.error(`Error getting suggestions for image ${imageId}:`, error);
        suggestions[imageId] = [];
      }
    }
    
    return suggestions;
  }
}

module.exports = TagSuggestionService; 