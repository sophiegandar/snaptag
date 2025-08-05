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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
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

  async getOrCreateTag(tagName) {
    // Try to get existing tag
    const existingTag = await this.get('SELECT id FROM tags WHERE name = $1', [tagName]);
    
    if (existingTag) {
      return existingTag.id;
    }

    // Create new tag
    const result = await this.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName]);
    return result.rows[0].id;
  }

  async searchImages(searchTerm, tagFilter) {
    try {
      console.log('🔍 PostgresService.searchImages called with:', { searchTerm, tagFilter });
      
      // Debug: Show all tags in database
      const allTags = await this.all('SELECT * FROM tags');
      const allFocusedTags = await this.all('SELECT * FROM focused_tags');
      console.log('📊 All regular tags in DB:', allTags.map(t => `"${t.name}"`).join(', '));
      console.log('📊 All focused tags in DB:', allFocusedTags.map(t => `"${t.tag_name}"`).join(', '));
      
      let query = `
        SELECT DISTINCT i.*, 
               STRING_AGG(DISTINCT t.name, ',') AS tag_names,
               COUNT(DISTINCT ft.id) AS focused_tag_count
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        LEFT JOIN focused_tags ft ON i.id = ft.image_id
      `;

      const params = [];
      const conditions = [];
      let paramCount = 0;
      
      console.log('📊 Initial query setup complete');

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
          console.log('📊 Content conditions count:', contentConditions.length);
          console.log('📊 Sample content conditions:', contentConditions.slice(0, 6));
          conditions.push(`(${contentConditions.join(' OR ')})`);
        }
      }

      // Tag filter (case-insensitive)
      if (tagFilter) {
        const tagArray = Array.isArray(tagFilter) ? tagFilter : tagFilter.split(',');
        const validTags = tagArray.filter(tag => tag && tag.toString().trim());
        
        if (validTags.length > 0) {
          const regularTagConditions = validTags.map(() => `LOWER(t.name) LIKE LOWER($${++paramCount})`).join(' OR ');
          const focusedTagConditions = validTags.map(() => `LOWER(ft.tag_name) LIKE LOWER($${++paramCount})`).join(' OR ');
          
          conditions.push(`(${regularTagConditions} OR ${focusedTagConditions})`);
          
          validTags.forEach(tag => params.push(`%${tag.toString().trim()}%`));
          validTags.forEach(tag => params.push(`%${tag.toString().trim()}%`));
        }
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += `
        GROUP BY i.id
        ORDER BY i.upload_date DESC
      `;

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

  async getFocusedTags(imageId) {
    return await this.all(`
      SELECT * FROM focused_tags 
      WHERE image_id = $1 
      ORDER BY created_at ASC
    `, [imageId]);
  }

  async getImageById(id) {
    try {
      const image = await this.get(`
        SELECT i.*, STRING_AGG(DISTINCT t.name, ',') AS tag_names
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        LEFT JOIN tags t ON it.tag_id = t.id
        WHERE i.id = $1
        GROUP BY i.id
      `, [id]);

      if (image) {
        image.tags = image.tag_names ? image.tag_names.split(',') : [];
        image.focused_tags = await this.getFocusedTags(id);
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

  async getAllTags() {
    return this.all('SELECT * FROM tags ORDER BY name');
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

  async updateImageTags(imageId, tags, focusedTags) {
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

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating image tags:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteImage(id) {
    await this.query('DELETE FROM images WHERE id = $1', [id]);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('✅ PostgreSQL connection closed');
    }
  }
}

module.exports = PostgresService; 