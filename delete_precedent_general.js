#!/usr/bin/env node

/**
 * Script to delete incorrectly tagged images with "precedent-general" filenames
 * Usage: node delete_precedent_general.js
 */

const https = require('https');

const SERVER_URL = 'https://snaptag.up.railway.app';

async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SERVER_URL + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function findAndDeletePrecedentGeneralImages() {
  try {
    console.log('🔍 Searching for incorrectly tagged images...');
    
    // Get all images
    const response = await makeRequest('/api/images');
    
    if (response.status !== 200) {
      console.error('❌ Failed to fetch images:', response.data);
      return;
    }
    
    const images = Array.isArray(response.data) ? response.data : response.data.images;
    console.log(`📊 Found ${images.length} total images`);
    
    // Find images with precedent-general in filename but should be archier-cornerhouse
    const incorrectImages = images.filter(img => {
      return img.filename && 
             img.filename.includes('precedent-general') &&
             img.source_url && 
             img.source_url.includes('corner'); // Assuming Corner House images have "corner" in URL
    });
    
    console.log(`🎯 Found ${incorrectImages.length} incorrectly tagged images:`);
    incorrectImages.forEach(img => {
      console.log(`  - ID: ${img.id}, Filename: ${img.filename}`);
    });
    
    if (incorrectImages.length === 0) {
      console.log('✅ No incorrectly tagged images found!');
      return;
    }
    
    // Ask for confirmation
    console.log('\n⚠️  Are you sure you want to delete these images?');
    console.log('   This will remove them from both the database and Dropbox.');
    console.log('   Type "yes" to continue, anything else to cancel:');
    
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', async (input) => {
      const confirmation = input.toString().trim().toLowerCase();
      
      if (confirmation !== 'yes') {
        console.log('❌ Deletion cancelled');
        process.exit(0);
      }
      
      // Delete each image
      console.log('\n🗑️  Deleting incorrectly tagged images...');
      let deleted = 0;
      
      for (const img of incorrectImages) {
        try {
          console.log(`🗑️  Deleting ${img.filename} (ID: ${img.id})...`);
          const deleteResponse = await makeRequest(`/api/images/${img.id}`, 'DELETE');
          
          if (deleteResponse.status === 200) {
            console.log(`✅ Successfully deleted ${img.filename}`);
            deleted++;
          } else {
            console.log(`❌ Failed to delete ${img.filename}:`, deleteResponse.data);
          }
        } catch (error) {
          console.log(`❌ Error deleting ${img.filename}:`, error.message);
        }
      }
      
      console.log(`\n🎉 Deletion complete! Deleted ${deleted}/${incorrectImages.length} images`);
      console.log('✅ Now you can re-run the batch save for Corner House images');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Make stdin readable for user input
process.stdin.setRawMode(false);
process.stdin.resume();

findAndDeletePrecedentGeneralImages();
