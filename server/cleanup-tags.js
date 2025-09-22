const PostgresService = require('./services/postgresService');

async function cleanupTags() {
  const db = new PostgresService();
  
  console.log('🧹 Starting tag cleanup...');
  
  try {
    // 1. Get all tags
    const tags = await db.getAllTags();
    console.log(`📊 Found ${tags.length} tags`);
    
    // 2. Find tags that contain commas (these should be split)
    const commaTagsToFix = tags.filter(tag => tag.name.includes(','));
    console.log(`🔍 Found ${commaTagsToFix.length} comma-separated tags to fix:`, commaTagsToFix.map(t => t.name));
    
    // 3. Find duplicate-style tags with parentheses (these should be merged)
    const duplicateTagsToFix = tags.filter(tag => tag.name.match(/\s\(\d+\)$/));
    console.log(`🔍 Found ${duplicateTagsToFix.length} duplicate tags to fix:`, duplicateTagsToFix.map(t => t.name));
    
    // 4. Process comma-separated tags
    for (const commaTag of commaTagsToFix) {
      console.log(`\n🔧 Processing comma tag: "${commaTag.name}"`);
      
      // Split the comma-separated tag into individual tags
      const individualTags = commaTag.name.split(',').map(t => t.trim().toLowerCase());
      console.log(`   → Split into: [${individualTags.join(', ')}]`);
      
      // Get all images that have this comma-separated tag
      const imagesWithCommaTag = await db.query(
        `SELECT id, tags FROM images WHERE tags @> $1::jsonb`,
        [JSON.stringify([commaTag.name])]
      );
      
      console.log(`   → Found ${imagesWithCommaTag.rows.length} images with this tag`);
      
      // For each image, replace the comma tag with individual tags
      for (const image of imagesWithCommaTag.rows) {
        const currentTags = image.tags || [];
        const updatedTags = currentTags.filter(tag => tag !== commaTag.name);
        
        // Add individual tags (avoid duplicates)
        for (const newTag of individualTags) {
          if (!updatedTags.includes(newTag)) {
            updatedTags.push(newTag);
          }
        }
        
        // Update the image
        await db.query(
          'UPDATE images SET tags = $1 WHERE id = $2',
          [JSON.stringify(updatedTags), image.id]
        );
        
        console.log(`   → Updated image ${image.id}: ${currentTags.length} → ${updatedTags.length} tags`);
      }
      
      // Delete the comma-separated tag if no longer used
      await db.query('DELETE FROM tags WHERE id = $1', [commaTag.id]);
      console.log(`   → Deleted comma tag "${commaTag.name}"`);
    }
    
    // 5. Process duplicate tags with parentheses
    for (const dupTag of duplicateTagsToFix) {
      console.log(`\n🔧 Processing duplicate tag: "${dupTag.name}"`);
      
      // Extract the base name (remove " (2)", " (3)", etc.)
      const baseName = dupTag.name.replace(/\s\(\d+\)$/, '').toLowerCase();
      console.log(`   → Base name: "${baseName}"`);
      
      // Find the original tag without parentheses
      const originalTag = tags.find(tag => tag.name.toLowerCase() === baseName && !tag.name.match(/\s\(\d+\)$/));
      
      if (originalTag) {
        console.log(`   → Found original tag: "${originalTag.name}"`);
        
        // Get all images with the duplicate tag
        const imagesWithDupTag = await db.query(
          `SELECT id, tags FROM images WHERE tags @> $1::jsonb`,
          [JSON.stringify([dupTag.name])]
        );
        
        console.log(`   → Found ${imagesWithDupTag.rows.length} images with duplicate tag`);
        
        // Replace duplicate tag with original tag
        for (const image of imagesWithDupTag.rows) {
          const currentTags = image.tags || [];
          const updatedTags = currentTags.map(tag => 
            tag === dupTag.name ? originalTag.name : tag
          );
          
          // Remove duplicates
          const uniqueTags = [...new Set(updatedTags)];
          
          await db.query(
            'UPDATE images SET tags = $1 WHERE id = $2',
            [JSON.stringify(uniqueTags), image.id]
          );
          
          console.log(`   → Updated image ${image.id}: replaced "${dupTag.name}" with "${originalTag.name}"`);
        }
        
        // Delete the duplicate tag
        await db.query('DELETE FROM tags WHERE id = $1', [dupTag.id]);
        console.log(`   → Deleted duplicate tag "${dupTag.name}"`);
      } else {
        console.log(`   → No original tag found for "${baseName}", keeping as-is`);
      }
    }
    
    console.log('\n✅ Tag cleanup completed!');
    
    // 6. Show final stats
    const finalTags = await db.getAllTags();
    console.log(`📊 Final tag count: ${finalTags.length}`);
    
    console.log('\n✅ Tag cleanup completed! Please restart the server to trigger project auto-creation.');
    console.log('📝 Next steps:');
    console.log('   1. Restart the server: npm start');
    console.log('   2. Save a new image with archier + complete + project name tags');
    console.log('   3. This will trigger auto-creation for that project');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  cleanupTags();
}

module.exports = cleanupTags;
