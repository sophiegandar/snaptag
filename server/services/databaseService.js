const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../data/snaptag.db');
  }

  async init() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Initialize database
      this.db = new sqlite3.Database(this.dbPath);
      
      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');
      
      // Create tables
      await this.createTables();
      
      // Run database migrations
      await this.migrateDatabaseSchema();
      
      console.log(`Database initialized: ${this.dbPath}`);
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    // Images table
    await this.run(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        dropbox_path TEXT UNIQUE NOT NULL,
        dropbox_id TEXT,
        title TEXT,
        description TEXT,
        upload_date TEXT NOT NULL,
        file_size INTEGER,
        source_url TEXT,
        width INTEGER,
        height INTEGER,
        mime_type TEXT,
        file_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tags table
    await this.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0
      )
    `);

    // Image-tags relationship table
    await this.run(`
      CREATE TABLE IF NOT EXISTS image_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
        UNIQUE(image_id, tag_id)
      )
    `);

    // Stages table
    await this.run(`
      CREATE TABLE IF NOT EXISTS stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0
      )
    `);

    // Rooms table
    await this.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        category TEXT,
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0
      )
    `);

    // Focused tags table (for click-to-tag functionality)
    await this.run(`
      CREATE TABLE IF NOT EXISTS focused_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        tag_name TEXT NOT NULL,
        x_coordinate REAL NOT NULL,
        y_coordinate REAL NOT NULL,
        width REAL,
        height REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await this.run('CREATE INDEX IF NOT EXISTS idx_images_dropbox_path ON images(dropbox_path)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_images_upload_date ON images(upload_date)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_images_source_url ON images(source_url)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_images_file_hash ON images(file_hash)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags(image_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_focused_tags_image ON focused_tags(image_id)');

    console.log('Database tables created successfully');
    
    // Initialize default stages and rooms if they don't exist
    await this.initializeDefaultStagesAndRooms();
  }

  async initializeDefaultStagesAndRooms() {
    try {
      // Check if stages table is empty
      const stageCount = await this.get('SELECT COUNT(*) as count FROM stages');
      if (stageCount.count === 0) {
        console.log('🔧 Initializing default stages...');
        const defaultStages = [
          { name: 'feasibility', description: 'Initial project evaluation and planning', order_index: 1 },
          { name: 'layout', description: 'Space planning and layout design', order_index: 2 },
          { name: 'finishes', description: 'Material and finish selection', order_index: 3 }
        ];

        for (const stage of defaultStages) {
          await this.run(`
            INSERT INTO stages (name, description, order_index)
            VALUES (?, ?, ?)
          `, [stage.name, stage.description, stage.order_index]);
        }
        console.log(`✅ Added ${defaultStages.length} default stages`);
      }

      // Check if rooms table is empty
      const roomCount = await this.get('SELECT COUNT(*) as count FROM rooms');
      if (roomCount.count === 0) {
        console.log('🔧 Initializing default rooms...');
        const defaultRooms = [
          { name: 'living', description: 'Living room spaces', category: 'common', order_index: 1 },
          { name: 'dining', description: 'Dining areas', category: 'common', order_index: 2 },
          { name: 'kitchen', description: 'Kitchen spaces', category: 'service', order_index: 3 },
          { name: 'bathroom', description: 'Bathroom and powder rooms', category: 'service', order_index: 4 },
          { name: 'bedroom', description: 'Bedroom spaces', category: 'private', order_index: 5 },
          { name: 'office', description: 'Office and study spaces', category: 'work', order_index: 6 },
          { name: 'outdoor', description: 'Outdoor and landscape areas', category: 'exterior', order_index: 7 }
        ];

        for (const room of defaultRooms) {
          await this.run(`
            INSERT INTO rooms (name, description, category, order_index)
            VALUES (?, ?, ?, ?)
          `, [room.name, room.description, room.category, room.order_index]);
        }
        console.log(`✅ Added ${defaultRooms.length} default rooms`);
      }
    } catch (error) {
      console.error('❌ Error initializing default stages and rooms:', error);
    }
  }

  async migrateDatabaseSchema() {
    try {
      // Check if file_hash column exists, if not add it
      const tableInfo = await this.all(`PRAGMA table_info(images)`);
      const hasFileHash = tableInfo.some(column => column.name === 'file_hash');
      
      if (!hasFileHash) {
        console.log('📊 Adding file_hash column to images table...');
        await this.run(`ALTER TABLE images ADD COLUMN file_hash TEXT`);
        await this.run(`CREATE INDEX IF NOT EXISTS idx_images_file_hash ON images(file_hash)`);
        console.log('✅ Database schema updated with file_hash column');
      }

      // Check if project_assignments column exists, if not add it
      const hasProjectAssignments = tableInfo.some(column => column.name === 'project_assignments');
      
      if (!hasProjectAssignments) {
        console.log('📊 Adding project_assignments column to images table...');
        await this.run(`ALTER TABLE images ADD COLUMN project_assignments TEXT`);
        console.log('✅ Database schema updated with project_assignments column');
      }
    } catch (error) {
      console.error('❌ Error migrating database schema:', error);
    }
  }

  async saveImage(imageData) {
    try {
      const {
        filename, original_name, dropbox_path, dropbox_id, title, name, description,
        upload_date, file_size, source_url, width, height, mime_type, file_hash, tags, focused_tags
      } = imageData;

      // Insert image
      const imageResult = await this.run(`
        INSERT INTO images (
          filename, original_name, dropbox_path, dropbox_id, title, name, description,
          upload_date, file_size, source_url, width, height, mime_type, file_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [filename, original_name, dropbox_path, dropbox_id, title, name, description,
          upload_date, file_size, source_url, width, height, mime_type, file_hash]);

      const imageId = imageResult.lastID;

      // Save tags
      if (tags && tags.length > 0) {
        await this.saveTags(imageId, tags);
      }

      // Save focused tags
      if (focused_tags && focused_tags.length > 0) {
        await this.saveFocusedTags(imageId, focused_tags);
      }

      return imageId;
    } catch (error) {
      console.error('Error saving image:', error);
      throw error;
    }
  }

  async saveTags(imageId, tags) {
    for (const tagName of tags) {
      // Insert or get tag
      const tagId = await this.getOrCreateTag(tagName);
      
      // Link image to tag
      await this.run(`
        INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)
      `, [imageId, tagId]);

      // Update usage count
      await this.run(`
        UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?
      `, [tagId]);
    }
  }

  async saveFocusedTags(imageId, focusedTags) {
    for (const focusedTag of focusedTags) {
      await this.run(`
        INSERT INTO focused_tags (image_id, tag_name, x_coordinate, y_coordinate, width, height)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [imageId, focusedTag.tag_name, focusedTag.x_coordinate, focusedTag.y_coordinate, focusedTag.width || null, focusedTag.height || null]);
    }
  }

  async getOrCreateTag(tagName) {
    // Try to get existing tag
    const existingTag = await this.get('SELECT id FROM tags WHERE name = ?', [tagName]);
    
    if (existingTag) {
      return existingTag.id;
    }

    // Create new tag
    const result = await this.run('INSERT INTO tags (name) VALUES (?)', [tagName]);
    return result.lastID;
  }

  async searchImages(searchTerm, tagFilter, sortBy = 'upload_date', sortOrder = 'desc') {
    try {
      console.log('🔍 DatabaseService.searchImages called with:', { searchTerm, tagFilter });
      
      // Debug: Show all tags in database
      const allTags = await this.all('SELECT * FROM tags');
      const allFocusedTags = await this.all('SELECT * FROM focused_tags');
      console.log('📊 All regular tags in DB:', allTags.map(t => `"${t.name}"`).join(', '));
      console.log('📊 All focused tags in DB:', allFocusedTags.map(t => `"${t.tag_name}"`).join(', '));
      
      let query = `
        SELECT DISTINCT i.*, 
               GROUP_CONCAT(DISTINCT t.name) AS tag_names,
               COUNT(DISTINCT ft.id) AS focused_tag_count
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        LEFT JOIN focused_tags ft ON i.id = ft.image_id
      `;

      const params = [];
      const conditions = [];
      
      console.log('📊 Initial query setup complete');

      // Smart search in content (case-insensitive)
      if (searchTerm && searchTerm.trim()) {
        const searchWords = searchTerm.trim().split(/\s+/);
        const contentConditions = [];
        
        // Common words to skip in individual word search (but not in exact phrase)
        const skipWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'de', 'la', 'le', 'el', 'un', 'una']);
        
        // PRIORITY 1: Search for exact phrase in content and tags (case-insensitive)
        contentConditions.push('LOWER(i.title) LIKE LOWER(?)');
        contentConditions.push('LOWER(i.description) LIKE LOWER(?)');
        contentConditions.push('LOWER(i.filename) LIKE LOWER(?)');
        contentConditions.push('LOWER(i.original_name) LIKE LOWER(?)');
        contentConditions.push('LOWER(i.name) LIKE LOWER(?)');
        contentConditions.push('LOWER(t.name) LIKE LOWER(?)');
        contentConditions.push('LOWER(ft.tag_name) LIKE LOWER(?)');
        const exactPattern = `%${searchTerm.trim()}%`;
        params.push(exactPattern, exactPattern, exactPattern, exactPattern, exactPattern, exactPattern, exactPattern);
        
        // PRIORITY 2: Individual word search - only for meaningful words
        // Only break into words if we have multiple words AND they're meaningful
        if (searchWords.length > 1) {
          const meaningfulWords = searchWords.filter(word => 
            word.length > 2 && !skipWords.has(word.toLowerCase())
          );
          
          meaningfulWords.forEach(word => {
            // Search in content fields
            contentConditions.push('LOWER(i.title) LIKE LOWER(?)');
            contentConditions.push('LOWER(i.description) LIKE LOWER(?)');
            contentConditions.push('LOWER(i.filename) LIKE LOWER(?)');
            contentConditions.push('LOWER(i.original_name) LIKE LOWER(?)');
            contentConditions.push('LOWER(i.name) LIKE LOWER(?)');
            // Search in tags
            contentConditions.push('LOWER(t.name) LIKE LOWER(?)');
            contentConditions.push('LOWER(ft.tag_name) LIKE LOWER(?)');
            const wordPattern = `%${word}%`;
            params.push(wordPattern, wordPattern, wordPattern, wordPattern, wordPattern, wordPattern, wordPattern);
          });
        }
        
        if (contentConditions.length > 0) {
          console.log('📊 Content conditions count:', contentConditions.length);
          console.log('📊 Search term:', searchTerm);
          console.log('📊 Exact pattern matches:', 7);
          console.log('📊 Individual word matches:', contentConditions.length - 7);
          conditions.push(`(${contentConditions.join(' OR ')})`);
        }
      }

      // Tag filter (case-insensitive) - requires ALL tags to match (AND logic)
      if (tagFilter) {
        const tagArray = Array.isArray(tagFilter) ? tagFilter : tagFilter.split(',');
        const validTags = tagArray.filter(tag => tag && tag.toString().trim());
        
        if (validTags.length > 0) {
          console.log('🔍 Tag filter - looking for ALL of these tags:', validTags);
          
          console.log('🔍 Tag filter - REWRITTEN: looking for ALL of these tags:', validTags);
          
          // COMPLETE REWRITE: Use a different query structure for exact tag matching
          // We'll rebuild the entire query to use proper tag counting
          
          query = `
            SELECT DISTINCT i.*, 
                   GROUP_CONCAT(DISTINCT t.name) AS tag_names,
                   COUNT(DISTINCT ft.id) AS focused_tag_count
            FROM images i
            LEFT JOIN image_tags it ON i.id = it.image_id
            LEFT JOIN tags t ON it.tag_id = t.id
            LEFT JOIN focused_tags ft ON i.id = ft.image_id
            WHERE i.id IN (
              SELECT image_id FROM (
                SELECT i2.id as image_id,
                       SUM(CASE WHEN LOWER(t2.name) IN (${validTags.map(() => '?').join(',')}) THEN 1 ELSE 0 END) +
                       SUM(CASE WHEN LOWER(ft2.tag_name) IN (${validTags.map(() => '?').join(',')}) THEN 1 ELSE 0 END) as matching_tags
                FROM images i2
                LEFT JOIN image_tags it2 ON i2.id = it2.image_id
                LEFT JOIN tags t2 ON it2.tag_id = t2.id
                LEFT JOIN focused_tags ft2 ON i2.id = ft2.image_id
                GROUP BY i2.id
                HAVING matching_tags >= ?
              )
            )
          `;
          
          // Add all the tag parameters twice (for regular and focused tags)
          validTags.forEach(tag => {
            const normalizedTag = tag.toString().trim().toLowerCase();
            params.push(normalizedTag);
          });
          validTags.forEach(tag => {
            const normalizedTag = tag.toString().trim().toLowerCase();
            params.push(normalizedTag);
          });
          
          // Add the required count (must match ALL tags)
          params.push(validTags.length);
          
          console.log(`🔍 REWRITTEN QUERY: Requires exactly ${validTags.length} matching tags`);
          
          // Clear conditions since we rebuilt the query
          conditions = [];
        }
      }

      // Only add WHERE clause if we have non-tag conditions AND didn't rewrite the query
      if (conditions.length > 0 && !query.includes('WHERE i.id IN')) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Build ORDER BY clause with proper column mapping
      const columnMapping = {
        'upload_date': 'i.upload_date',
        'name': 'i.name',
        'file_size': 'i.file_size', 
        'width': 'i.width',
        'height': 'i.height',
        'filename': 'i.filename'
      };
      
      const orderColumn = columnMapping[sortBy] || 'i.upload_date';
      const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += `
        GROUP BY i.id
        ORDER BY ${orderColumn} ${orderDirection}
      `;
      
      console.log('📊 Sorting by:', sortBy, sortOrder, '→', orderColumn, orderDirection);

      console.log('📊 Final query:', query);
      console.log('📊 Query params:', params);

      const images = await this.all(query, params);
      console.log('📊 Database returned:', images.length, 'raw results');
      
      // Debug: Show what tags each image actually has
      for (const image of images) {
        console.log(`📊 Image ${image.id}: regular tags = "${image.tag_names}", focused_tag_count = ${image.focused_tag_count}`);
      }

      // Get focused tags for each image
      for (const image of images) {
        image.focused_tags = await this.getFocusedTags(image.id);
        image.tags = image.tag_names ? image.tag_names.split(',') : [];
      }

      console.log('📊 Processed results:', images.length, 'images with tags');
      return images;
    } catch (error) {
      console.error('❌ Error searching images:', error);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  // New method for searching with project assignment filters
  async searchImagesWithProjectAssignments(searchFilters) {
    try {
      const { searchTerm, tags, projectAssignment, sortBy = 'upload_date', sortOrder = 'desc' } = searchFilters;
      
      console.log('🔍 DatabaseService.searchImagesWithProjectAssignments called with:', searchFilters);
      
      let query = `
        SELECT DISTINCT i.*, 
               GROUP_CONCAT(DISTINCT t.name) AS tag_names,
               COUNT(DISTINCT ft.id) AS focused_tag_count
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        LEFT JOIN focused_tags ft ON i.id = ft.image_id
      `;

      const params = [];
      const conditions = [];

      // Handle traditional tag search (if no project assignment filter)
      if (tags && tags.length > 0 && !projectAssignment) {
        console.log('🔍 Traditional tag search for:', tags);
        
        // Use the existing tag search logic for regular tag queries
        return this.searchImages(searchTerm, tags, sortBy, sortOrder);
      }

      // Handle project assignment search
      if (projectAssignment) {
        console.log('🔍 Project assignment search:', projectAssignment);
        
        // For project assignment search, we need to check the project_assignments JSON field
        if (projectAssignment.projectId) {
          // Filter images that have a project assignment matching the project ID
          conditions.push(`i.project_assignments LIKE ?`);
          params.push(`%"projectId":"${projectAssignment.projectId}"%`);
          
          // Additional filters for room and stage if specified
          if (projectAssignment.room) {
            conditions.push(`i.project_assignments LIKE ?`);
            params.push(`%"room":"${projectAssignment.room}"%`);
          }
          
          if (projectAssignment.stage) {
            conditions.push(`i.project_assignments LIKE ?`);
            params.push(`%"stage":"${projectAssignment.stage}"%`);
          }
        }
      }

      // Handle regular tags (these should be present regardless of project assignment)
      if (tags && tags.length > 0) {
        console.log('🔍 Adding tag requirements:', tags);
        
        // For project assignment searches, we still need the basic type tags (precedent, texture, etc.)
        const tagPlaceholders = tags.map(() => '?').join(',');
        conditions.push(`i.id IN (
          SELECT image_id FROM (
            SELECT i2.id as image_id,
                   SUM(CASE WHEN LOWER(t2.name) IN (${tagPlaceholders}) THEN 1 ELSE 0 END) +
                   SUM(CASE WHEN LOWER(ft2.tag_name) IN (${tagPlaceholders}) THEN 1 ELSE 0 END) as matching_tags
            FROM images i2
            LEFT JOIN image_tags it2 ON i2.id = it2.image_id
            LEFT JOIN tags t2 ON it2.tag_id = t2.id
            LEFT JOIN focused_tags ft2 ON i2.id = ft2.image_id
            GROUP BY i2.id
            HAVING matching_tags >= ?
          )
        )`);
        
        // Add tag parameters twice (for regular and focused tags)
        tags.forEach(tag => params.push(tag.toLowerCase()));
        tags.forEach(tag => params.push(tag.toLowerCase()));
        params.push(tags.length); // Required matching count
      }

      // Apply conditions
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Add ordering
      const columnMapping = {
        'upload_date': 'i.upload_date',
        'name': 'i.name',
        'file_size': 'i.file_size', 
        'width': 'i.width',
        'height': 'i.height',
        'filename': 'i.filename'
      };
      
      const orderColumn = columnMapping[sortBy] || 'i.upload_date';
      const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += `
        GROUP BY i.id
        ORDER BY ${orderColumn} ${orderDirection}
      `;

      console.log('🔍 Final query:', query);
      console.log('🔍 Query params:', params);

      const images = await this.all(query, params);
      
      // Process results same as regular search
      const processedImages = images.map(image => ({
        ...image,
        tags: image.tag_names ? image.tag_names.split(',') : [],
        focused_tags: [], // Will be loaded separately if needed
        project_assignments: (() => {
          try {
            return image.project_assignments ? JSON.parse(image.project_assignments) : [];
          } catch (e) {
            console.warn(`Failed to parse project_assignments for image ${image.id}:`, e);
            return [];
          }
        })()
      }));

      console.log(`✅ Found ${processedImages.length} images with project assignment filters`);
      return processedImages;

    } catch (error) {
      console.error('Error searching images with project assignments:', error);
      throw error;
    }
  }

  async getImageById(id) {
    try {
      const image = await this.get(`
        SELECT i.*, GROUP_CONCAT(t.name) AS tag_names
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        WHERE i.id = ?
        GROUP BY i.id
      `, [id]);

      if (image) {
        image.tags = image.tag_names ? image.tag_names.split(',') : [];
        image.focused_tags = await this.getFocusedTags(id);
        
        // Parse project assignments from JSON
        try {
          image.project_assignments = image.project_assignments 
            ? JSON.parse(image.project_assignments) 
            : [];
        } catch (e) {
          console.warn(`Failed to parse project_assignments for image ${id}:`, e);
          image.project_assignments = [];
        }
      }

      return image;
    } catch (error) {
      console.error('Error getting image by ID:', error);
      throw error;
    }
  }

  async getAllImages() {
    return this.all('SELECT * FROM images ORDER BY created_at DESC');
  }

  async getImageTags(imageId) {
    try {
      return await this.all(`
        SELECT t.id, t.name, t.color
        FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = ?
        ORDER BY t.name
      `, [imageId]);
    } catch (error) {
      console.error('Error getting image tags:', error);
      throw error;
    }
  }

  async getFocusedTags(imageId) {
    return await this.all(
      'SELECT * FROM focused_tags WHERE image_id = ? ORDER BY created_at',
      [imageId]
    );
  }

  async updateImageTags(imageId, tags, focusedTags, projectAssignments = null) {
    try {
      // Start transaction
      await this.run('BEGIN TRANSACTION');

      // Remove existing tags
      await this.run('DELETE FROM image_tags WHERE image_id = ?', [imageId]);
      await this.run('DELETE FROM focused_tags WHERE image_id = ?', [imageId]);

      // Add new tags
      if (tags && tags.length > 0) {
        await this.saveTags(imageId, tags);
      }

      // Add new focused tags
      if (focusedTags && focusedTags.length > 0) {
        await this.saveFocusedTags(imageId, focusedTags);
      }

      // Update project assignments if provided
      if (projectAssignments !== null) {
        const projectAssignmentsJson = JSON.stringify(projectAssignments);
        await this.run('UPDATE images SET project_assignments = ? WHERE id = ?', [projectAssignmentsJson, imageId]);
      }

      // Update timestamp
      await this.run('UPDATE images SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [imageId]);

      await this.run('COMMIT');
    } catch (error) {
      await this.run('ROLLBACK');
      console.error('Error updating image tags:', error);
      throw error;
    }
  }

  async updateImageSource(imageId, sourceUrl) {
    await this.run('UPDATE images SET source_url = ? WHERE id = ?', [sourceUrl, imageId]);
  }

  async deleteImage(id) {
    await this.run('DELETE FROM images WHERE id = ?', [id]);
  }

  async getAllTags() {
    return await this.all(`
      SELECT t.*, COUNT(it.image_id) as usage_count 
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id
      ORDER BY usage_count DESC, t.name
    `);
  }

  async getPopularTags(limit = 20) {
    return await this.all(`
      SELECT t.name, COUNT(it.image_id) as usage_count
      FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id
      ORDER BY usage_count DESC
      LIMIT ?
    `, [limit]);
  }

  async getImageStats() {
    const stats = await this.get(`
      SELECT 
        COUNT(*) as total_images,
        COUNT(DISTINCT it.tag_id) as total_tags,
        AVG(file_size) as avg_file_size,
        MAX(upload_date) as latest_upload
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
    `);

    return stats;
  }

  async advancedSearchImages(filters = {}) {
    try {
      const {
        searchTerm,
        tags = [],
        dateRange = {},
        sizeRange = {},
        dimensions = {},
        contentType = [],
        sourceFilter,
        sortBy = 'upload_date',
        sortOrder = 'desc'
      } = filters;

      let query = `
        SELECT DISTINCT i.*, 
               GROUP_CONCAT(DISTINCT t.name) AS tag_names,
               COUNT(DISTINCT ft.id) AS focused_tag_count
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        LEFT JOIN focused_tags ft ON i.id = ft.image_id
      `;

      const params = [];
      const conditions = [];

      // Text search
      if (searchTerm && searchTerm.trim()) {
        conditions.push(`(
          i.title LIKE ? OR 
          i.description LIKE ? OR 
          i.filename LIKE ? OR 
          i.original_name LIKE ?
        )`);
        const searchPattern = `%${searchTerm.trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Tag filters
      if (tags.length > 0) {
        const tagConditions = tags.map(() => 't.name = ?').join(' OR ');
        conditions.push(`(${tagConditions})`);
        tags.forEach(tag => params.push(tag));
      }

      // Content type filters (check filename patterns)
      if (contentType.length > 0) {
        const contentConditions = contentType.map(() => {
          return `(i.filename LIKE ? OR i.title LIKE ? OR i.description LIKE ?)`;
        }).join(' OR ');
        conditions.push(`(${contentConditions})`);
        
        contentType.forEach(type => {
          const pattern = `%${type}%`;
          params.push(pattern, pattern, pattern);
        });
      }

      // Date range filter
      if (dateRange.start) {
        conditions.push('DATE(i.upload_date) >= ?');
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        conditions.push('DATE(i.upload_date) <= ?');
        params.push(dateRange.end);
      }

      // File size filter
      if (sizeRange.min > 0) {
        conditions.push('i.file_size >= ?');
        params.push(sizeRange.min);
      }
      if (sizeRange.max && sizeRange.max < 10000000) {
        conditions.push('i.file_size <= ?');
        params.push(sizeRange.max);
      }

      // Dimensions filter
      if (dimensions.minWidth > 0) {
        conditions.push('i.width >= ?');
        params.push(dimensions.minWidth);
      }
      if (dimensions.minHeight > 0) {
        conditions.push('i.height >= ?');
        params.push(dimensions.minHeight);
      }

      // Source filter
      if (sourceFilter && sourceFilter.trim()) {
        conditions.push('i.source_url LIKE ?');
        params.push(`%${sourceFilter.trim()}%`);
      }

      // Add WHERE clause if conditions exist
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Group by image
      query += ' GROUP BY i.id';

      // Add sorting
      const validSortColumns = ['upload_date', 'title', 'filename', 'file_size', 'width', 'height'];
      const validSortOrders = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy) && validSortOrders.includes(sortOrder)) {
        query += ` ORDER BY i.${sortBy} ${sortOrder.toUpperCase()}`;
      } else {
        query += ' ORDER BY i.upload_date DESC'; // Default fallback
      }

      console.log('🔍 Advanced search query:', query);
      console.log('🔍 Advanced search params:', params);

      const images = await this.all(query, params);

      // Get focused tags for each image
      for (const image of images) {
        image.focused_tags = await this.getFocusedTags(image.id);
        image.tags = image.tag_names ? image.tag_names.split(',') : [];
      }

      console.log(`🔍 Advanced search found ${images.length} images`);
      return images;

    } catch (error) {
      console.error('Error in advanced search:', error);
      throw error;
    }
  }

  async getImageSources() {
    try {
      const sources = await this.all(`
        SELECT DISTINCT 
          CASE 
            WHEN source_url IS NOT NULL AND source_url != '' 
            THEN SUBSTR(source_url, INSTR(source_url, '://') + 3)
            ELSE 'Direct Upload'
          END as source_domain
        FROM images 
        WHERE source_url IS NOT NULL AND source_url != ''
        ORDER BY source_domain
      `);

      return sources.map(row => {
        const domain = row.source_domain;
        // Extract just the domain part (remove path)
        const domainOnly = domain.split('/')[0];
        // Remove www. prefix
        return domainOnly.replace(/^www\./, '');
      }).filter((domain, index, self) => 
        domain && domain !== 'Direct Upload' && self.indexOf(domain) === index
      );

    } catch (error) {
      console.error('Error getting image sources:', error);
      return [];
    }
  }

  // Database helper methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Duplicate detection methods
  async checkDuplicateByUrl(sourceUrl) {
    if (!sourceUrl) return null;
    
    return await this.get(`
      SELECT id, filename, original_name, created_at, dropbox_path
      FROM images 
      WHERE source_url = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [sourceUrl]);
  }

  async checkDuplicateByHash(fileHash) {
    if (!fileHash) return null;
    
    return await this.get(`
      SELECT id, filename, original_name, created_at, dropbox_path
      FROM images 
      WHERE file_hash = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [fileHash]);
  }

  async updateImageHash(imageId, fileHash) {
    await this.run(`
      UPDATE images 
      SET file_hash = ?
      WHERE id = ?
    `, [fileHash, imageId]);
  }

  // Stages management methods
  async getAllStages() {
    return await this.all(`
      SELECT s.*, 
             COUNT(t.id) as usage_count 
      FROM stages s
      LEFT JOIN tags t ON t.name = s.name
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY s.id
      ORDER BY s.order_index, s.name
    `);
  }

  async createStage(name, description = '', orderIndex = 0) {
    try {
      const result = await this.run(`
        INSERT INTO stages (name, description, order_index)
        VALUES (?, ?, ?)
      `, [name.toLowerCase().trim(), description, orderIndex]);
      
      return { id: result.lastID, name: name.toLowerCase().trim(), description, order_index: orderIndex };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('A stage with this name already exists');
      }
      throw error;
    }
  }

  async updateStage(id, name, description = '', orderIndex = 0) {
    try {
      await this.run(`
        UPDATE stages 
        SET name = ?, description = ?, order_index = ?
        WHERE id = ?
      `, [name.toLowerCase().trim(), description, orderIndex, id]);
      
      return { id, name: name.toLowerCase().trim(), description, order_index: orderIndex };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('A stage with this name already exists');
      }
      throw error;
    }
  }

  async deleteStage(id) {
    await this.run('DELETE FROM stages WHERE id = ?', [id]);
  }

  // Rooms management methods
  async getAllRooms() {
    return await this.all(`
      SELECT r.*, 
             COUNT(t.id) as usage_count 
      FROM rooms r
      LEFT JOIN tags t ON t.name = r.name
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY r.id
      ORDER BY r.order_index, r.name
    `);
  }

  async createRoom(name, description = '', category = '', orderIndex = 0) {
    try {
      const result = await this.run(`
        INSERT INTO rooms (name, description, category, order_index)
        VALUES (?, ?, ?, ?)
      `, [name.toLowerCase().trim(), description, category, orderIndex]);
      
      return { id: result.lastID, name: name.toLowerCase().trim(), description, category, order_index: orderIndex };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('A room with this name already exists');
      }
      throw error;
    }
  }

  async updateRoom(id, name, description = '', category = '', orderIndex = 0) {
    try {
      await this.run(`
        UPDATE rooms 
        SET name = ?, description = ?, category = ?, order_index = ?
        WHERE id = ?
      `, [name.toLowerCase().trim(), description, category, orderIndex, id]);
      
      return { id, name: name.toLowerCase().trim(), description, category, order_index: orderIndex };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new Error('A room with this name already exists');
      }
      throw error;
    }
  }

  async deleteRoom(id) {
    await this.run('DELETE FROM rooms WHERE id = ?', [id]);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = new DatabaseService(); 