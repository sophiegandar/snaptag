#!/usr/bin/env node

/**
 * CRITICAL CLEANUP SCRIPT: Remove comma-separated tag strings
 * 
 * This script will:
 * 1. Find all tags containing commas (like "Archier, complete, corner house")
 * 2. Split them into individual tags
 * 3. Reassign images to the individual tags
 * 4. Delete the comma-separated tag strings
 */

const PostgresService = require('./services/postgresService');

async function cleanupCommaTags() {
  const databaseService = new PostgresService();
  
  try {
    console.log('🧹 Starting comma-separated tag cleanup...');
    
    // 1. Find all tags containing commas
    const commaTagsResult = await databaseService.query(`
      SELECT id, name FROM tags WHERE name LIKE '%,%'
    `);
    
    const commaTags = commaTagsResult.rows;
    console.log(`📊 Found ${commaTags.length} comma-separated tags to clean up`);
    
    if (commaTags.length === 0) {
      console.log('✅ No comma-separated tags found. Database is clean!');
      return;
    }
    
    // Display the problematic tags
    console.log('🚨 Problematic tags found:');
    commaTags.forEach(tag => {
      console.log(`  - "${tag.name}" (ID: ${tag.id})`);
    });
    
    let totalImagesReassigned = 0;
    let totalTagsDeleted = 0;
    
    // 2. Process each comma-separated tag
    for (const commaTag of commaTags) {
      console.log(`\n🔧 Processing: "${commaTag.name}"`);
      
      // Split the tag into individual tags
      const individualTags = commaTag.name
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0);
      
      console.log(`  📝 Will split into: [${individualTags.join(', ')}]`);
      
      // 3. Find all images using this comma-separated tag
      const imagesResult = await databaseService.query(`
        SELECT DISTINCT image_id FROM image_tags WHERE tag_id = $1
      `, [commaTag.id]);
      
      const imageIds = imagesResult.rows.map(row => row.image_id);
      console.log(`  📸 Found ${imageIds.length} images using this tag`);
      
      if (imageIds.length > 0) {
        // 4. For each individual tag, ensure it exists and assign images to it
        for (const individualTag of individualTags) {
          // Get or create the individual tag
          const tagId = await databaseService.getOrCreateTag(individualTag);
          
          // Assign all images to this individual tag (avoid duplicates)
          for (const imageId of imageIds) {
            try {
              await databaseService.query(`
                INSERT INTO image_tags (image_id, tag_id)
                VALUES ($1, $2)
                ON CONFLICT (image_id, tag_id) DO NOTHING
              `, [imageId, tagId]);
            } catch (error) {
              // Ignore duplicate key errors
              if (!error.message.includes('duplicate key')) {
                console.error(`    ❌ Error assigning tag "${individualTag}" to image ${imageId}:`, error.message);
              }
            }
          }
          
          console.log(`    ✅ Assigned "${individualTag}" to ${imageIds.length} images`);
        }
        
        totalImagesReassigned += imageIds.length * individualTags.length;
      }
      
      // 5. Remove the comma-separated tag
      // First remove all image_tag relationships
      await databaseService.query(`
        DELETE FROM image_tags WHERE tag_id = $1
      `, [commaTag.id]);
      
      // Then delete the tag itself
      await databaseService.query(`
        DELETE FROM tags WHERE id = $1
      `, [commaTag.id]);
      
      console.log(`  🗑️ Deleted comma-separated tag "${commaTag.name}"`);
      totalTagsDeleted++;
    }
    
    console.log('\n🎉 CLEANUP COMPLETE!');
    console.log(`📊 Summary:`);
    console.log(`  - Deleted ${totalTagsDeleted} comma-separated tags`);
    console.log(`  - Reassigned ${totalImagesReassigned} image-tag relationships`);
    console.log(`  - Created ${commaTags.reduce((acc, tag) => acc + tag.name.split(',').length, 0)} individual tags`);
    
    // 6. Show final tag count
    const finalTagCountResult = await databaseService.query('SELECT COUNT(*) as count FROM tags');
    console.log(`  - Final tag count: ${finalTagCountResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup if this file is executed directly
if (require.main === module) {
  cleanupCommaTags()
    .then(() => {
      console.log('✅ Cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupCommaTags };
