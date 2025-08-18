class TagSuggestionService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Generate tag suggestions for an untagged image
   * @param {Object} image - Image object with metadata
   * @returns {Array} Array of suggested tags with confidence scores
   */
  async generateSuggestions(image) {
    const suggestions = [];
    
    try {
      console.log(`🔍 TagSuggestionService.generateSuggestions called for: ${image.filename}`);
      console.log(`🔗 Image URL: ${image.url ? 'Present' : 'Missing'}`);
      console.log(`🔑 OpenAI API Key: ${this.openaiApiKey ? 'Present' : 'Missing'}`);
      
      // 1. AI VISUAL ANALYSIS (Primary - highest priority)
      if (this.openaiApiKey && image.url && !image.url.includes('placeholder')) {
        console.log('🤖 Using OpenAI Vision API for intelligent analysis...');
        const visualSuggestions = await this.getVisualAnalysisSuggestions(image);
        console.log(`🎯 Visual AI returned ${visualSuggestions.length} suggestions`);
        suggestions.push(...visualSuggestions);
      } else {
        const reasons = [];
        if (!this.openaiApiKey) reasons.push('No OpenAI API key');
        if (!image.url) reasons.push('No image URL');
        if (image.url && image.url.includes('placeholder')) reasons.push('Placeholder URL');
        console.log(`⚠️ Skipping visual AI analysis: ${reasons.join(', ')}`);
      }
      
      // 2. Source-based suggestions (fallback)
      const sourceSuggestions = await this.getSuggestionsFromSource(image.source_url);
      suggestions.push(...sourceSuggestions);
      
      // 3. Filename-based suggestions  
      const filenameSuggestions = await this.getSuggestionsFromFilename(image.filename);
      suggestions.push(...filenameSuggestions);
      
      // 4. Description-based suggestions
      if (image.description) {
        const descriptionSuggestions = await this.getSuggestionsFromDescription(image.description);
        suggestions.push(...descriptionSuggestions);
      }
      
      // 5. Pattern-based suggestions from similar images
      const patternSuggestions = await this.getSuggestionsFromPatterns(image);
      suggestions.push(...patternSuggestions);
      
      // Consolidate and rank suggestions (visual analysis gets highest priority)
      return this.consolidateAndRankSuggestions(suggestions);
      
    } catch (error) {
      console.error('Error generating tag suggestions:', error);
      return [];
    }
  }

  /**
   * INTELLIGENT VISUAL ANALYSIS using OpenAI Vision API
   * Provides actual image understanding, not just keyword matching
   */
  async getVisualAnalysisSuggestions(image) {
    try {
      if (!this.openaiApiKey) {
        console.log('⚠️ OpenAI API key not configured - skipping visual analysis');
        return [];
      }

      console.log(`🔍 Analyzing image: ${image.filename}`);
      console.log(`🎯 Using enhanced architectural prompt v2.0`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an expert architectural photographer analyzing this image for a professional architecture firm's database. 

Analyze what you can ACTUALLY SEE and suggest 4-8 specific, descriptive tags from these categories:

SPACES & ROOMS: interior, exterior, living-room, kitchen, bathroom, bedroom, dining-room, office, stairway, courtyard, deck, balcony
ARCHITECTURAL ELEMENTS: windows, doors, stairs, ceiling, floor, walls, roof, columns, beams, railing, skylight, glazing
MATERIALS: timber, wood, concrete, steel, metal, stone, brick, glass, tile, plaster, fabric, leather
LIGHTING & ATMOSPHERE: natural-light, artificial-light, daylight, evening, moody, bright, shadowy
DESIGN STYLES: modern, contemporary, minimalist, industrial, rustic, traditional, mid-century
SPECIFIC FEATURES: built-in-storage, open-plan, double-height, exposed-beams, floor-to-ceiling-windows, polished-concrete

IMPORTANT: 
- Focus on VISIBLE architectural elements, materials, and spatial qualities
- Use descriptive terms that architects would search for
- Be specific about materials (e.g., "timber" not just "wood", "polished-concrete" not just "floor")
- Include lighting conditions and spatial qualities you can observe
- DO NOT suggest project names, locations, or internal filing categories

Respond ONLY with a JSON array:
[{"tag": "interior", "confidence": 95, "reason": "Indoor living space clearly visible"}, {"tag": "timber", "confidence": 90, "reason": "Exposed wooden ceiling beams and wall paneling"}, {"tag": "natural-light", "confidence": 85, "reason": "Bright daylight streaming through large windows"}]`
              },
              {
                type: "image_url",
                image_url: {
                  url: image.url
                }
              }
            ]
          }],
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ OpenAI Vision API error:', error);
        return [];
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      
      if (!content) {
        console.error('❌ No content in OpenAI response');
        return [];
      }

      // Parse the JSON response
      try {
        const visualTags = JSON.parse(content);
        console.log(`✅ Visual analysis complete: ${visualTags.length} tags identified`);
        
        // Add priority and source info
        return visualTags.map(tag => ({
          ...tag,
          priority: 0, // HIGHEST priority for visual AI analysis (0 = top priority)
          source: 'visual_ai'
        }));
        
      } catch (parseError) {
        console.error('❌ Failed to parse OpenAI response:', content);
        return [];
      }

    } catch (error) {
      console.error('❌ Visual analysis error:', error);
      return [];
    }
  }

  /**
   * Analyse source URL for tag suggestions
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
   * Analyse filename for tag suggestions
   */
  async getSuggestionsFromFilename(filename) {
    const suggestions = [];
    
    if (!filename) return suggestions;
    
    const cleanFilename = filename.toLowerCase()
      .replace(/\.(jpg|jpeg|png|gif|webp|heic|heif|tiff|avif|svg)$/i, '') // Remove extension
      .replace(/[^a-z0-9\s-]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalise spaces
      .trim();
    
    console.log(`🔍 Analyzing filename: "${filename}" -> cleaned: "${cleanFilename}"`);
    
    // PRIORITY 1: Folder structure tags (high confidence)
    const folderStructureTags = {
      // NOTE: Internal filing tags like 'archier', 'precedent', 'texture', 'materials' 
      // are excluded from suggestions as they are internal classification tags
      
      // Archier project names
      'yandoit': 0.9, 'ballarat': 0.9, 'melbourne': 0.9, 'brunswick': 0.9, 
      'geelong': 0.9, 'sydney': 0.9, 'adelaide': 0.9, 'perth': 0.9,
      
      // Project status
      'final': 0.9, 'complete': 0.9, 'wip': 0.9,
      
      // Precedent categories (use plural forms for folder structure)
      'exteriors': 0.9,  // Use plural for folder structure
      'interiors': 0.9,
      'bathrooms': 0.9,
      'kitchens': 0.9,
      'landscape': 0.9,
      'furniture': 0.9,
      'lighting': 0.9,
      'stairs': 0.9,
      'details': 0.9,
      'doors': 0.9,
      'structure': 0.9,
      'spatial': 0.9,
      'joinery': 0.9,
      
      // Material categories
      'wood': 0.9,
      'metal': 0.9,
      'concrete': 0.9,
      'glass': 0.9,
      'brick': 0.9,
      'stone': 0.9,
      'tile': 0.9,
      'fabric': 0.9,
      'carpet': 0.9,
      
      // Base categories (note: avoid internal filing tags)
      'complete': 0.85,
      'wip': 0.85
    };
    
    // PRIORITY 2: Supplementary/descriptive tags (medium confidence)
    const descriptiveTags = {
      // Specific materials and finishes
      'timber': 0.7, 'wooden': 0.7, 'steel': 0.7, 'aluminum': 0.7,
      'marble': 0.7, 'granite': 0.7, 'ceramic': 0.7,
      
      // Architectural elements
      'window': 0.7, 'windows': 0.7, 'door': 0.6, 'roof': 0.7, 'ceiling': 0.7,
      'floor': 0.7, 'wall': 0.6, 'walls': 0.6, 'column': 0.7, 'beam': 0.7,
      
      // Descriptive elements
      'deck': 0.6, 'balcony': 0.7, 'terrace': 0.7, 'courtyard': 0.7,
      'garden': 0.7, 'pool': 0.7, 'entrance': 0.7,
      
      // Natural elements (supplementary)
      'tree': 0.6, 'trees': 0.6, 'gum': 0.5, 'eucalyptus': 0.5,
      'oak': 0.5, 'pine': 0.5, 'palm': 0.5,
      
      // Design styles (supplementary)
      'modern': 0.5, 'contemporary': 0.5, 'traditional': 0.5, 
      'minimalist': 0.5, 'industrial': 0.5,
      
      // Colors and textures (low priority)
      'black': 0.4, 'white': 0.4, 'grey': 0.4, 'natural': 0.4,
      'textured': 0.4, 'smooth': 0.4
    };
    
    // Check folder structure tags first
    Object.entries(folderStructureTags).forEach(([keyword, confidence]) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(cleanFilename)) {
        suggestions.push({
          tag: keyword,
          confidence: confidence,
          reason: `Folder structure: "${keyword}"`,
          priority: 1
        });
        console.log(`✅ Found folder tag "${keyword}" with confidence ${confidence}`);
      }
    });
    
    // Then check descriptive tags
    Object.entries(descriptiveTags).forEach(([keyword, confidence]) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(cleanFilename)) {
        suggestions.push({
          tag: keyword,
          confidence: confidence,
          reason: `Descriptive element: "${keyword}"`,
          priority: 2
        });
        console.log(`✅ Found descriptive tag "${keyword}" with confidence ${confidence}`);
      }
    });
    
    // Pattern matching for common combinations
    const patterns = [
      { pattern: /\b(out|outdoor|outside)\b/i, tag: 'exteriors', confidence: 0.9, priority: 1 },
      { pattern: /\b(in|indoor|inside|internal)\b/i, tag: 'interiors', confidence: 0.9, priority: 1 },
      { pattern: /\b(yard|garden|park)\b/i, tag: 'landscape', confidence: 0.9, priority: 1 },
      { pattern: /\b(timber|lumber|plywood)\b/i, tag: 'wood', confidence: 0.9, priority: 1 },
      { pattern: /\b(steel|aluminum|iron|metallic)\b/i, tag: 'metal', confidence: 0.9, priority: 1 },
      { pattern: /\b(gum tree|eucalyptus)\b/i, tag: 'gum tree', confidence: 0.6, priority: 2 },
      { pattern: /\b(timber deck|wooden deck)\b/i, tag: 'timber deck', confidence: 0.7, priority: 2 }
    ];
    
    patterns.forEach(({ pattern, tag, confidence, priority }) => {
      if (pattern.test(cleanFilename)) {
        suggestions.push({
          tag: tag,
          confidence: confidence,
          reason: `Pattern match: "${tag}"`,
          priority: priority
        });
        console.log(`✅ Pattern match for "${tag}" (priority ${priority})`);
      }
    });
    
    console.log(`📊 Generated ${suggestions.length} suggestions from filename analysis`);
    return suggestions;
  }

  /**
   * Analyse description for tag suggestions
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
      // Find most common tags overall, but limit their influence
      const result = await this.databaseService.query(`
        SELECT t.name, COUNT(*) as usage_count
        FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        GROUP BY t.name
        ORDER BY usage_count DESC
        LIMIT 3
      `);
      
      result.rows.forEach(row => {
        suggestions.push({
          tag: row.name,
          confidence: 0.2, // Reduced confidence for general suggestions
          reason: `Commonly used tag (${row.usage_count} times)`
        });
      });
      
      // Add base architectural suggestions if no specific patterns found
      const baseArchitecturalSuggestions = [
        // Folder structure tags (high priority)
        { tag: 'exteriors', confidence: 0.4, reason: 'Common folder category', priority: 1 },
        { tag: 'interiors', confidence: 0.4, reason: 'Common folder category', priority: 1 },
        { tag: 'landscape', confidence: 0.4, reason: 'Common folder category', priority: 1 },
        { tag: 'bathrooms', confidence: 0.4, reason: 'Common folder category', priority: 1 },
        { tag: 'kitchens', confidence: 0.4, reason: 'Common folder category', priority: 1 },
        
        // Material categories (high priority)
        { tag: 'wood', confidence: 0.4, reason: 'Common material', priority: 1 },
        { tag: 'metal', confidence: 0.4, reason: 'Common material', priority: 1 },
        { tag: 'concrete', confidence: 0.4, reason: 'Common material', priority: 1 },
        { tag: 'glass', confidence: 0.4, reason: 'Common material', priority: 1 },
        
        // Supplementary tags (lower priority)
        { tag: 'modern', confidence: 0.3, reason: 'Common architectural style', priority: 2 },
        { tag: 'design', confidence: 0.3, reason: 'Common architectural term', priority: 2 }
      ];
      
      suggestions.push(...baseArchitecturalSuggestions);
      
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
        // Keep the highest priority (1 is higher than 2)
        existing.priority = Math.min(existing.priority || 3, suggestion.priority || 3);
      } else {
        tagMap.set(suggestion.tag, {
          tag: suggestion.tag,
          confidence: suggestion.confidence,
          reasons: [suggestion.reason],
          priority: suggestion.priority || 3
        });
      }
    });
    
    // Convert to array and sort by priority first, then confidence
    return Array.from(tagMap.values())
      .sort((a, b) => {
        // First sort by priority (1 = folder structure, 2 = descriptive, 3 = general)
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Then by confidence within same priority
        return b.confidence - a.confidence;
      })
      .slice(0, 8) // Return top 8 suggestions
      .map(item => ({
        tag: item.tag,
        confidence: Math.round(item.confidence * 100),
        reason: item.reasons[0], // Show primary reason
        priority: item.priority
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