const { Pool } = require('pg');

class PostgresService {
  constructor() {
    this.pool = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // Use Railway's DATABASE_URL environment variable
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test connection
      const client = await this.pool.connect();
      console.log('✅ PostgreSQL connected successfully');
      client.release();

      // Create tables
      await this.createTables();
      
      this.isInitialized = true;
      console.log('✅ PostgreSQL database initialized');
    } catch (error) {
      console.error('❌ PostgreSQL initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    
    try {
      // Enable UUID extension
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

      // Images table
      await client.query(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          dropbox_path VARCHAR(500) UNIQUE NOT NULL,
          dropbox_id VARCHAR(255),
          title TEXT,
          description TEXT,
          upload_date TIMESTAMP NOT NULL,
          file_size INTEGER,
          source_url TEXT,
          width INTEGER,
          height INTEGER,
          mime_type VARCHAR(100),
          file_hash VARCHAR(64),
          project_assignments TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add project_assignments column if it doesn't exist (migration)
      await client.query(`
        ALTER TABLE images 
        ADD COLUMN IF NOT EXISTS project_assignments TEXT
      `);

      // Tags table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tags (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          color VARCHAR(7),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          usage_count INTEGER DEFAULT 0
        )
      `);

      // Image-tags relationship table
      await client.query(`
        CREATE TABLE IF NOT EXISTS image_tags (
          id SERIAL PRIMARY KEY,
          image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(image_id, tag_id)
        )
      `);

      // Focused tags table
      await client.query(`
        CREATE TABLE IF NOT EXISTS focused_tags (
          id SERIAL PRIMARY KEY,
          image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
          tag_name VARCHAR(255) NOT NULL,
          x_coordinate REAL NOT NULL,
          y_coordinate REAL NOT NULL,
          width REAL,
          height REAL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Stages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS stages (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          order_index INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          usage_count INTEGER DEFAULT 0
        )
      `);

      // Rooms table
      await client.query(`
        CREATE TABLE IF NOT EXISTS rooms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          category VARCHAR(255),
          order_index INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          usage_count INTEGER DEFAULT 0
        )
      `);

      // Image sequence counter table (for atomic sequence number generation)
      await client.query(`
        CREATE TABLE IF NOT EXISTS image_sequence (
          id INTEGER PRIMARY KEY DEFAULT 1,
          last_sequence INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_images_dropbox_path ON images(dropbox_path)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_images_file_hash ON images(file_hash)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags(image_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_focused_tags_image ON focused_tags(image_id)');

      console.log('✅ PostgreSQL tables created successfully');
    } finally {
      client.release();
    }
  }

  async query(text, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async get(query, params = []) {
    const result = await this.query(query, params);
    return result.rows[0] || null;
  }

  async all(query, params = []) {
    const result = await this.query(query, params);
    return result.rows;
  }

  async run(query, params = []) {
    const result = await this.query(query, params);
    return {
      lastID: result.rows[0]?.id,
      changes: result.rowCount
    };
  }

  // Same interface methods as SQLite service
  async saveImage(imageData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        filename, original_name, dropbox_path, dropbox_id, title, description,
        upload_date, file_size, source_url, width, height, mime_type, file_hash, tags, focused_tags
      } = imageData;

      // Insert image
      const imageResult = await client.query(`
        INSERT INTO images (
          filename, original_name, dropbox_path, dropbox_id, title, description,
          upload_date, file_size, source_url, width, height, mime_type, file_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [filename, original_name, dropbox_path, dropbox_id, title, description,
          upload_date, file_size, source_url, width, height, mime_type, file_hash]);

      const imageId = imageResult.rows[0].id;

      // Save tags
      if (tags && tags.length > 0) {
        await this.saveTags(imageId, tags, client);
      }

      // Save focused tags
      if (focused_tags && focused_tags.length > 0) {
        await this.saveFocusedTags(imageId, focused_tags, client);
      }

      await client.query('COMMIT');
      return imageId;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving image:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveTags(imageId, tags, client = null) {
    const useClient = client || await this.pool.connect();
    
    try {
      for (const tagName of tags) {
        // Insert or get tag
        const tagId = await this.getOrCreateTag(tagName, useClient);
        
        // Link image to tag
        await useClient.query(`
          INSERT INTO image_tags (image_id, tag_id) VALUES ($1, $2)
          ON CONFLICT (image_id, tag_id) DO NOTHING
        `, [imageId, tagId]);
      }
    } finally {
      if (!client) useClient.release();
    }
  }

  async saveFocusedTags(imageId, focusedTags, client = null) {
    const useClient = client || await this.pool.connect();
    
    try {
      for (const focusedTag of focusedTags) {
        await useClient.query(`
          INSERT INTO focused_tags (image_id, tag_name, x_coordinate, y_coordinate, width, height)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [imageId, focusedTag.tag_name, focusedTag.x_coordinate, focusedTag.y_coordinate, 
            focusedTag.width || null, focusedTag.height || null]);
      }
    } finally {
      if (!client) useClient.release();
    }
  }

  async getOrCreateTag(tagName, client = null) {
    const useClient = client || await this.pool.connect();
    
    try {
      // Normalize tag name to lowercase and trim whitespace
      const normalizedTagName = tagName.toLowerCase().trim();
      
      if (!normalizedTagName) {
        throw new Error('Tag name cannot be empty');
      }
      
      console.log(`🏷️ Getting or creating tag: "${tagName}" -> normalized: "${normalizedTagName}"`);
      
      // Check if tag already exists (case-insensitive)
      const existingTag = await useClient.query(
        'SELECT id FROM tags WHERE LOWER(name) = LOWER($1)',
        [normalizedTagName]
      );
      
      if (existingTag.rows.length > 0) {
        console.log(`✅ Found existing tag with ID: ${existingTag.rows[0].id}`);
        return existingTag.rows[0].id;
      }
      
      // Create new tag with normalized name
      const result = await useClient.query(
        'INSERT INTO tags (name, created_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id',
        [normalizedTagName]
      );
      
      console.log(`✅ Created new tag "${normalizedTagName}" with ID: ${result.rows[0].id}`);
      return result.rows[0].id;
      
    } finally {
      if (!client) {
        useClient.release();
      }
    }
  }

  async searchImages(searchTerm, tagFilter, sortBy = 'upload_date', sortOrder = 'desc') {
    try {
      // Removed debug overhead for performance
      
      // PERFORMANCE OPTIMIZED: Single query with JSON aggregation to eliminate N+1 problem
      let query = `
        SELECT DISTINCT i.*, 
               COALESCE(json_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '[]') as tags,
               COALESCE(json_agg(DISTINCT jsonb_build_object(
                 'tag_name', ft.tag_name,
                 'x_coordinate', ft.x_coordinate,
                 'y_coordinate', ft.y_coordinate,
                 'width', ft.width,
                 'height', ft.height
               )) FILTER (WHERE ft.tag_name IS NOT NULL), '[]') as focused_tags
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        LEFT JOIN focused_tags ft ON i.id = ft.image_id
      `;

      const params = [];
      const conditions = [];
      let paramCount = 0;

      // Smart search in content (case-insensitive)
      if (searchTerm && searchTerm.trim()) {
        const searchWords = searchTerm.trim().split(/\s+/);
        const contentConditions = [];
        
        // Search for exact phrase in content (case-insensitive)
        contentConditions.push(`LOWER(i.title) LIKE LOWER($${++paramCount})`);
        contentConditions.push(`LOWER(i.description) LIKE LOWER($${++paramCount})`);
        contentConditions.push(`LOWER(i.filename) LIKE LOWER($${++paramCount})`);
        contentConditions.push(`LOWER(i.original_name) LIKE LOWER($${++paramCount})`);
        const exactPattern = `%${searchTerm.trim()}%`;
        params.push(exactPattern, exactPattern, exactPattern, exactPattern);
        
        // Search for individual words in content
        searchWords.forEach(word => {
          if (word.length > 2) {
            contentConditions.push(`LOWER(i.title) LIKE LOWER($${++paramCount})`);
            contentConditions.push(`LOWER(i.description) LIKE LOWER($${++paramCount})`);
            contentConditions.push(`LOWER(i.filename) LIKE LOWER($${++paramCount})`);
            contentConditions.push(`LOWER(i.original_name) LIKE LOWER($${++paramCount})`);
            const wordPattern = `%${word}%`;
            params.push(wordPattern, wordPattern, wordPattern, wordPattern);
          }
        });
        
        // Search in tags (both regular and focused, case-insensitive)
        // Exact phrase in tags - ALWAYS include this
        contentConditions.push(`LOWER(t.name) LIKE LOWER($${++paramCount})`);
        contentConditions.push(`LOWER(ft.tag_name) LIKE LOWER($${++paramCount})`);
        params.push(exactPattern, exactPattern);
        
        // Individual words in tags - include ALL words, not just length > 2
        searchWords.forEach(word => {
          if (word.length > 1) {
            contentConditions.push(`LOWER(t.name) LIKE LOWER($${++paramCount})`);
            contentConditions.push(`LOWER(ft.tag_name) LIKE LOWER($${++paramCount})`);
            const wordPattern = `%${word}%`;
            params.push(wordPattern, wordPattern);
          }
        });
        
        if (contentConditions.length > 0) {
          conditions.push(`(${contentConditions.join(' OR ')})`);
        }
      }

      // Tag filter - CRITICAL FIX: Enforce ALL required tags (AND logic)
      if (tagFilter) {
        const tagArray = Array.isArray(tagFilter) ? tagFilter : tagFilter.split(',');
        const validTags = tagArray.filter(tag => tag && tag.toString().trim());
        
        if (validTags.length > 0) {
          // SIMPLE AND RELIABLE: Use EXISTS for each required tag
          // This enforces strict AND logic - image must have ALL specified tags
          
          validTags.forEach(tag => {
            const trimmedTag = tag.toString().trim();
            const existsCondition = `
              EXISTS (
                SELECT 1 FROM image_tags it2 
                JOIN tags t2 ON it2.tag_id = t2.id 
                WHERE it2.image_id = i.id AND LOWER(t2.name) = LOWER($${++paramCount})
              ) OR EXISTS (
                SELECT 1 FROM focused_tags ft2 
                WHERE ft2.image_id = i.id AND LOWER(ft2.tag_name) = LOWER($${++paramCount})
              )
            `;
            conditions.push(`(${existsCondition})`);
            params.push(trimmedTag, trimmedTag);
          });
          
          // Removed debug logging for performance
        }
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Add sorting and pagination
      const validSortColumns = ['upload_date', 'filename', 'file_size', 'created_at'];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'upload_date';
      const sortDirection = sortOrder && sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      query += `
        GROUP BY i.id, i.filename, i.upload_date, i.file_size, i.created_at, i.original_name, i.dropbox_path, i.dropbox_id, i.title, i.description, i.source_url, i.width, i.height, i.mime_type, i.file_hash, i.project_assignments, i.updated_at
        ORDER BY i.${sortColumn} ${sortDirection}
      `;

      const result = await this.query(query, params);
      const images = result.rows || [];

      // PERFORMANCE: Process JSON results (no additional queries needed!)
      for (const image of images) {
        // Parse JSON arrays returned by PostgreSQL
        image.tags = Array.isArray(image.tags) ? image.tags : (image.tags || []);
        image.focused_tags = Array.isArray(image.focused_tags) ? image.focused_tags : (image.focused_tags || []);
        
        // Add legacy fields for backwards compatibility
        image.tag_names = image.tags.join(',');
        image.focused_tag_count = image.focused_tags.length;
      }

      return images;
    } catch (error) {
      console.error('❌ Error searching images:', error);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  async getFocusedTags(imageId) {
    return await this.all(`
      SELECT * FROM focused_tags 
      WHERE image_id = $1 
      ORDER BY created_at ASC
    `, [imageId]);
  }

  async getImageById(id) {
    try {
      console.log(`🗃️ PostgreSQL: Getting image by ID: ${id}`);
      
      const image = await this.get(`
        SELECT i.*, STRING_AGG(DISTINCT t.name, ',') AS tag_names
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        WHERE i.id = $1
        GROUP BY i.id
      `, [id]);

      console.log(`🗃️ PostgreSQL: Query result for image ${id}:`, image ? 'Found' : 'Not found');
      
      if (image) {
        console.log(`🗃️ PostgreSQL: Image data - filename: ${image.filename}, path: ${image.dropbox_path}`);
        image.tags = image.tag_names ? image.tag_names.split(',') : [];
        
        // Parse project assignments
        if (image.project_assignments) {
          try {
            image.project_assignments = JSON.parse(image.project_assignments);
          } catch (e) {
            console.warn('Failed to parse project_assignments:', e);
            image.project_assignments = [];
          }
        } else {
          image.project_assignments = [];
        }
        
        console.log(`🗃️ PostgreSQL: Getting focused tags for image ${id}`);
        image.focused_tags = await this.getFocusedTags(id);
        console.log(`🗃️ PostgreSQL: Found ${image.focused_tags.length} focused tags`);
      }

      return image;
    } catch (error) {
      console.error(`❌ PostgreSQL Error getting image ${id}:`, error);
      console.error(`❌ PostgreSQL Error stack:`, error.stack);
      throw error;
    }
  }

  async getAllImages() {
    return this.all('SELECT * FROM images ORDER BY created_at DESC');
  }

  async getAllTags() {
    // Get tags with actual usage counts from image_tags table
    return this.all(`
      SELECT t.id, t.name, t.color, t.created_at,
             COALESCE(COUNT(it.image_id), 0) as usage_count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id, t.name, t.color, t.created_at
      ORDER BY COALESCE(COUNT(it.image_id), 0) DESC, t.name ASC
    `);
  }

  async getImageSources() {
    const result = await this.all(`
      SELECT DISTINCT source_url 
      FROM images 
      WHERE source_url IS NOT NULL AND source_url != ''
      ORDER BY source_url
    `);
    return result.map(row => row.source_url);
  }

  async getImageStats() {
    const stats = await this.get(`
      SELECT 
        COUNT(*) as total_images,
        COUNT(DISTINCT source_url) as unique_sources,
        AVG(file_size) as avg_file_size,
        SUM(file_size) as total_file_size
      FROM images
    `);
    
    const tagStats = await this.get('SELECT COUNT(*) as total_tags FROM tags');
    
    return {
      totalImages: parseInt(stats.total_images) || 0,
      uniqueSources: parseInt(stats.unique_sources) || 0,
      avgFileSize: Math.round(parseFloat(stats.avg_file_size) || 0),
      totalFileSize: parseInt(stats.total_file_size) || 0,
      totalTags: parseInt(tagStats.total_tags) || 0
    };
  }

  async updateImageTags(imageId, tags, focusedTags, projectAssignments = null) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Remove existing tags
      await client.query('DELETE FROM image_tags WHERE image_id = $1', [imageId]);
      await client.query('DELETE FROM focused_tags WHERE image_id = $1', [imageId]);

      // Add new tags
      if (tags && tags.length > 0) {
        await this.saveTags(imageId, tags, client);
      }

      // Add new focused tags
      if (focusedTags && focusedTags.length > 0) {
        await this.saveFocusedTags(imageId, focusedTags, client);
      }

      // Update project assignments if provided
      if (projectAssignments !== null) {
        const projectAssignmentsJson = JSON.stringify(projectAssignments);
        await client.query(
          'UPDATE images SET project_assignments = $1 WHERE id = $2',
          [projectAssignmentsJson, imageId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating image tags:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateImageSource(imageId, sourceUrl) {
    await this.query('UPDATE images SET source_url = $1 WHERE id = $2', [sourceUrl, imageId]);
  }

  async deleteImage(id) {
    await this.query('DELETE FROM images WHERE id = $1', [id]);
  }

  // Duplicate detection methods
  async checkDuplicateByUrl(sourceUrl) {
    if (!sourceUrl) return null;
    
    return await this.get(`
      SELECT id, filename, original_name, created_at, dropbox_path
      FROM images 
      WHERE source_url = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [sourceUrl]);
  }

  async checkDuplicateByHash(fileHash) {
    if (!fileHash) return null;
    
    return await this.get(`
      SELECT id, filename, original_name, created_at, dropbox_path
      FROM images 
      WHERE file_hash = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [fileHash]);
  }

  // Stages and Rooms Management
  async getAllStages() {
    const result = await this.query(`
      SELECT id, name, description, order_index, created_at, COALESCE(usage_count, 0) as usage_count
      FROM stages 
      ORDER BY order_index ASC, name ASC
    `);
    return result.rows;
  }

  async createStage(name, description = '', orderIndex = 0) {
    const result = await this.query(`
      INSERT INTO stages (name, description, order_index, usage_count) 
      VALUES ($1, $2, $3, 0) 
      RETURNING *
    `, [name, description, orderIndex]);
    return result.rows[0];
  }

  async updateStage(id, name, description = '', orderIndex = 0) {
    const result = await this.query(`
      UPDATE stages 
      SET name = $1, description = $2, order_index = $3 
      WHERE id = $4 
      RETURNING *
    `, [name, description, orderIndex, id]);
    return result.rows[0];
  }

  async deleteStage(id) {
    const result = await this.query('DELETE FROM stages WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  async getAllRooms() {
    const result = await this.query(`
      SELECT id, name, description, category, order_index, created_at, COALESCE(usage_count, 0) as usage_count
      FROM rooms 
      ORDER BY order_index ASC, name ASC
    `);
    return result.rows;
  }

  async createRoom(name, description = '', category = '', orderIndex = 0) {
    const result = await this.query(`
      INSERT INTO rooms (name, description, category, order_index, usage_count) 
      VALUES ($1, $2, $3, $4, 0) 
      RETURNING *
    `, [name, description, category, orderIndex]);
    return result.rows[0];
  }

  async updateRoom(id, name, description = '', category = '', orderIndex = 0) {
    const result = await this.query(`
      UPDATE rooms 
      SET name = $1, description = $2, category = $3, order_index = $4 
      WHERE id = $5 
      RETURNING *
    `, [name, description, category, orderIndex, id]);
    return result.rows[0];
  }

  async deleteRoom(id) {
    const result = await this.query('DELETE FROM rooms WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  // Project assignments search method
  async searchImagesWithProjectAssignments(searchFilters) {
    try {
      console.log('🔍 searchImagesWithProjectAssignments called with:', JSON.stringify(searchFilters, null, 2));
      const { projectAssignment, tags, searchTerm } = searchFilters;
      
      let query = `
        SELECT DISTINCT i.*, 
               COALESCE(string_agg(DISTINCT t.name, ',' ORDER BY t.name), '') as tags,
               COALESCE(json_agg(DISTINCT jsonb_build_object(
                 'tag_name', ft.tag_name,
                 'x_coordinate', ft.x_coordinate,
                 'y_coordinate', ft.y_coordinate,
                 'width', ft.width,
                 'height', ft.height
               )) FILTER (WHERE ft.tag_name IS NOT NULL), '[]') as focused_tags
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        LEFT JOIN focused_tags ft ON i.id = ft.image_id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 0;
      
      // Filter by project assignments if specified
      if (projectAssignment) {
        console.log('🔍 Processing project assignment filter:', projectAssignment);
        const { projectId, room, stage } = projectAssignment;
        
        // Convert projectId to actual project name for matching
        let projectName = projectId;
        if (projectId === 'de-witt') {
          projectName = 'de witt st';
        } else if (projectId === 'light-house') {
          projectName = 'light house';
        }
        console.log(`🔍 Mapped projectId "${projectId}" to projectName "${projectName}"`);
        
        // First, check if there are any images with project_assignments at all
        const testQuery = `SELECT COUNT(*) as total, 
                                  COUNT(CASE WHEN project_assignments IS NOT NULL AND project_assignments != '' THEN 1 END) as with_assignments
                           FROM images`;
        const testResult = await this.query(testQuery);
        console.log(`📊 Database stats: ${testResult.rows[0].total} total images, ${testResult.rows[0].with_assignments} with project assignments`);
        
        // Sample some project assignments to see the data structure
        const sampleQuery = `SELECT id, filename, project_assignments FROM images 
                             WHERE project_assignments IS NOT NULL AND project_assignments != '' 
                             LIMIT 3`;
        const sampleResult = await this.query(sampleQuery);
        console.log(`📊 Sample project assignments:`, sampleResult.rows);
        
        // Build a more flexible search for project assignments
        let assignmentConditions = [];
        
        // Must contain the project (using simple string search)
        paramCount++;
        assignmentConditions.push(`COALESCE(i.project_assignments, '') ILIKE $${paramCount}`);
        const searchPattern = `%"projectId":"${projectId}"%`;
        params.push(searchPattern);
        
        console.log(`🔍 Searching for project assignment containing: ${searchPattern}`);
        
        // If room is specified, must also contain that room
        if (room) {
          paramCount++;
          assignmentConditions.push(`COALESCE(i.project_assignments, '') ILIKE $${paramCount}`);
          params.push(`%"room":"${room}"%`);
        }
        
        // If stage is specified, must also contain that stage  
        if (stage) {
          paramCount++;
          assignmentConditions.push(`COALESCE(i.project_assignments, '') ILIKE $${paramCount}`);
          params.push(`%"stage":"${stage}"%`);
        }
        
        query += ` AND i.project_assignments IS NOT NULL AND (${assignmentConditions.join(' AND ')})`;
      }
      
      // Filter by tags if specified
      if (tags && tags.length > 0) {
        const tagConditions = tags.map(() => {
          paramCount++;
          return `t.name = $${paramCount}`;
        });
        query += ` AND (${tagConditions.join(' OR ')})`;
        params.push(...tags);
      }
      
      // Filter by search term if specified
      if (searchTerm) {
        paramCount++;
        query += ` AND (
          i.filename ILIKE $${paramCount} OR 
          i.original_name ILIKE $${paramCount} OR 
          i.title ILIKE $${paramCount} OR 
          i.description ILIKE $${paramCount}
        )`;
        params.push(`%${searchTerm}%`);
      }
      
      query += `
        GROUP BY i.id, i.filename, i.original_name, i.dropbox_path, i.dropbox_id, 
                 i.title, i.description, i.upload_date, i.file_size, i.source_url,
                 i.width, i.height, i.mime_type, i.file_hash, i.project_assignments,
                 i.created_at, i.updated_at
        ORDER BY i.upload_date DESC
      `;
      
      console.log('🔍 Final query:', query);
      console.log('🔍 Query params:', params);
      
      const result = await this.query(query, params);
      console.log('🔍 Query result count:', result.rows.length);
      const images = result.rows.map(row => ({
        ...row,
        tags: row.tags ? row.tags.split(',').filter(tag => tag.trim()) : [],
        focused_tags: row.focused_tags || [],
        project_assignments: row.project_assignments ? JSON.parse(row.project_assignments) : []
      }));
      
      return images;
    } catch (error) {
      console.error('❌ Error in searchImagesWithProjectAssignments:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        searchFilters: JSON.stringify(searchFilters, null, 2)
      });
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('✅ PostgreSQL connection closed');
    }
  }
}

module.exports = PostgresService; 