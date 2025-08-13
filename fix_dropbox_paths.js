const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateDropboxPaths() {
  console.log('🔄 Starting Dropbox path updates...');
  
  try {
    // Update Precedents -> Precedent
    const precedentsResult = await pool.query(`
      UPDATE images 
      SET dropbox_path = REPLACE(dropbox_path, '/SnapTag/Precedents/', '/SnapTag/Precedent/')
      WHERE dropbox_path LIKE '%/SnapTag/Precedents/%'
      RETURNING id, filename, dropbox_path
    `);
    
    console.log(`✅ Updated ${precedentsResult.rowCount} files: Precedents → Precedent`);
    
    // Update Materials -> Texture
    const materialsResult = await pool.query(`
      UPDATE images 
      SET dropbox_path = REPLACE(dropbox_path, '/SnapTag/Materials/', '/SnapTag/Texture/')
      WHERE dropbox_path LIKE '%/SnapTag/Materials/%'
      RETURNING id, filename, dropbox_path
    `);
    
    console.log(`✅ Updated ${materialsResult.rowCount} files: Materials → Texture`);
    
    // Fix missing file extensions (add .jpg to files ending with just a dot)
    const extensionResult = await pool.query(`
      UPDATE images 
      SET 
        dropbox_path = REPLACE(dropbox_path, filename, filename || 'jpg'),
        filename = filename || 'jpg'
      WHERE filename LIKE '%.'
      RETURNING id, filename, dropbox_path
    `);
    
    console.log(`✅ Fixed ${extensionResult.rowCount} files with missing extensions`);
    
    // Show some examples of updated paths
    console.log('\n📋 Sample updated paths:');
    const sampleResult = await pool.query(`
      SELECT filename, dropbox_path 
      FROM images 
      WHERE dropbox_path LIKE '%/SnapTag/Precedent/%' OR dropbox_path LIKE '%/SnapTag/Texture/%'
      LIMIT 5
    `);
    
    sampleResult.rows.forEach(row => {
      console.log(`  ${row.filename} → ${row.dropbox_path}`);
    });
    
    console.log('\n🎉 Dropbox path updates completed!');
    
  } catch (error) {
    console.error('❌ Error updating paths:', error);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  updateDropboxPaths();
}

module.exports = { updateDropboxPaths }; 