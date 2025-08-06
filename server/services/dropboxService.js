const { Dropbox } = require('dropbox');
const fs = require('fs').promises;
const https = require('https');
const querystring = require('querystring');
const fetch = require('node-fetch'); // Add fetch for raw HTTP requests

class DropboxService {
  constructor() {
    // Use environment variables from .env file (no hardcoded fallbacks)
    this.currentAccessToken = process.env.DROPBOX_ACCESS_TOKEN;
    this.refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    this.appKey = process.env.DROPBOX_APP_KEY;
    this.appSecret = process.env.DROPBOX_APP_SECRET;
    
    // ROOT NAMESPACE ID - CRITICAL FOR TEAM FOLDER ACCESS
    // This ensures files go to shared team folder, not personal space
    this.rootNamespaceId = process.env.DROPBOX_ROOT_NAMESPACE_ID || '3266276627';
    
    // For Dropbox Business teams, specify which team member to operate as
    this.selectUser = process.env.DROPBOX_SELECT_USER;
    
    this.dbx = new Dropbox({ 
      accessToken: this.currentAccessToken,
      // selectUser: this.selectUser, // Temporarily disabled - permission issue
      fetch: fetch // Use global fetch in Node.js 18+
    });

    console.log('🔧 Dropbox Service initialized');
    console.log(`   Has Access Token: ${!!this.currentAccessToken}`);
    console.log(`   Has Refresh Token: ${!!this.refreshToken}`);
    console.log(`   Has App Credentials: ${!!(this.appKey && this.appSecret)}`);
    console.log(`   Root Namespace ID: ${this.rootNamespaceId} (for team folder access)`);
    console.log(`   Team Member: ${this.selectUser || 'None'}`);
  }

  async refreshAccessToken() {
    if (!this.refreshToken || !this.appKey || !this.appSecret) {
      throw new Error('Missing refresh token or app credentials. Run setup-dropbox-refresh.js first.');
    }

    try {
      console.log('🔄 Refreshing Dropbox access token...');
      
      const tokenData = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.appKey,
        client_secret: this.appSecret
      });

      const response = await this.makeHttpsRequest('api.dropbox.com', '/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(tokenData)
        },
        data: tokenData
      });

      if (response.error) {
        throw new Error(`Token refresh failed: ${response.error_description || response.error}`);
      }

      this.currentAccessToken = response.access_token;
      
      // Update the Dropbox client with new token
      this.dbx = new Dropbox({ 
        accessToken: this.currentAccessToken,
        // selectUser: this.selectUser, // Temporarily disabled - permission issue
        fetch: fetch
      });

      console.log('✅ Access token refreshed successfully');
      return this.currentAccessToken;

    } catch (error) {
      console.error('❌ Error refreshing access token:', error.message);
      throw error;
    }
  }

  // Move/rename file in Dropbox (much faster than download-upload-delete)
  async moveFile(fromPath, toPath) {
    return this.executeWithRetry(async (fromPath, toPath) => {
      try {
        console.log('🚚 Moving file in Dropbox...');
        console.log(`   From: ${fromPath}`);
        console.log(`   To: ${toPath}`);
        
        // Use raw HTTP request with Path-Root header for team folder access
        const pathRootHeader = JSON.stringify({
          '.tag': 'root',
          'root': this.rootNamespaceId
        });
        
        const response = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.currentAccessToken}`,
            'Content-Type': 'application/json',
            'Dropbox-API-Path-Root': pathRootHeader
          },
          body: JSON.stringify({
            from_path: fromPath,
            to_path: toPath,
            allow_shared_folder: true,
            autorename: false,
            allow_ownership_transfer: false
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const result = await response.json();
        console.log(`✅ File moved successfully: ${fromPath} → ${toPath}`);
        return result;
      } catch (error) {
        console.error('❌ Error moving file in Dropbox:', error);
        throw new Error(`Failed to move file in Dropbox: ${error.message}`);
      }
    }, fromPath, toPath);
  }

  async makeHttpsRequest(hostname, path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname,
        path,
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            resolve({ raw: data, statusCode: res.statusCode });
          }
        });
      });

      req.on('error', reject);
      
      if (options.data) {
        req.write(options.data);
      }
      
      req.end();
    });
  }

  async executeWithRetry(operation, ...args) {
    try {
      return await operation.apply(this, args);
    } catch (error) {
      // Check if it's an authentication error (multiple formats)
      const isAuthError = 
        error.status === 401 || 
        (error.error && error.error.error_summary && error.error.error_summary.includes('invalid_access_token')) ||
        (error.message && error.message.includes('HTTP 401')) ||
        (error.message && error.message.includes('expired_access_token'));
      
      if (isAuthError) {
        console.log('🔄 Access token expired, attempting refresh...');
        
        try {
          await this.refreshAccessToken();
          console.log('✅ Token refreshed, retrying operation...');
          // Retry the operation with the new token
          return await operation.apply(this, args);
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError.message);
          throw new Error(`Authentication failed and token refresh failed: ${refreshError.message}`);
        }
      }
      
      // If it's not an auth error, just re-throw
      throw error;
    }
  }

  async uploadFile(localFilePath, dropboxPath, overwrite = false) {
    return this.executeWithRetry(async (localFilePath, dropboxPath, overwrite) => {
      try {
        console.log('📖 Reading file for upload:', localFilePath);
        const fileBuffer = await fs.readFile(localFilePath);
        console.log('📊 File buffer size:', fileBuffer.length, 'bytes');
        
        if (fileBuffer.length === 0) {
          throw new Error(`File is empty: ${localFilePath}`);
        }
        
        console.log('🎯 Using Path-Root header for team folder access');
        console.log('   Root Namespace ID:', this.rootNamespaceId);
        
        // Use raw HTTP request with Path-Root header for team folder access
        const pathRootHeader = JSON.stringify({
          '.tag': 'root',
          'root': this.rootNamespaceId
        });
        
        // Set upload mode based on overwrite parameter
        const uploadMode = overwrite ? 'overwrite' : 'add';
        console.log(`📤 Upload mode: ${uploadMode}${overwrite ? ' (replacing existing file)' : ' (creating new file)'}`);
        
        const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.currentAccessToken}`,
            'Dropbox-API-Arg': JSON.stringify({
              path: dropboxPath,
              mode: uploadMode,
              autorename: overwrite ? false : true
            }),
            'Dropbox-API-Path-Root': pathRootHeader,
            'Content-Type': 'application/octet-stream'
          },
          body: fileBuffer
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const result = await response.json();
        console.log(`📤 File uploaded to Dropbox: ${dropboxPath}`);
        console.log('✅ Using team folder access - file accessible to all team members!');
        return result;
      } catch (error) {
        console.error('❌ Error uploading to Dropbox:', error);
        throw new Error(`Failed to upload file to Dropbox: ${error.message}`);
      }
    }, localFilePath, dropboxPath, overwrite);
  }

  async downloadFile(dropboxPath, localFilePath) {
    return this.executeWithRetry(async (dropboxPath, localFilePath) => {
      try {
        console.log('📥 Downloading file with Path-Root header for team folder access');
        
        // Use raw HTTP request with Path-Root header for team folder access
        const pathRootHeader = JSON.stringify({
          '.tag': 'root',
          'root': this.rootNamespaceId
        });
        
        const response = await fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.currentAccessToken}`,
            'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath }),
            'Dropbox-API-Path-Root': pathRootHeader
          }
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const fileBuffer = await response.arrayBuffer();
        await fs.writeFile(localFilePath, Buffer.from(fileBuffer));
        console.log(`✅ File downloaded from Dropbox: ${dropboxPath}`);
        
        return localFilePath;
      } catch (error) {
        console.error('❌ Error downloading from Dropbox:', error);
        throw new Error(`Failed to download file from Dropbox: ${error.message}`);
      }
    }, dropboxPath, localFilePath);
  }

  async deleteFile(dropboxPath) {
    return this.executeWithRetry(async (dropboxPath) => {
      try {
        console.log('🗑️ Deleting file with Path-Root header for team folder access');
        
        // Use raw HTTP request with Path-Root header for team folder access
        const pathRootHeader = JSON.stringify({
          '.tag': 'root',
          'root': this.rootNamespaceId
        });
        
        const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.currentAccessToken}`,
            'Dropbox-API-Path-Root': pathRootHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ path: dropboxPath })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const result = await response.json();
        console.log(`✅ File deleted from Dropbox: ${dropboxPath}`);
        return result;
      } catch (error) {
        console.error('❌ Error deleting from Dropbox:', error);
        throw new Error(`Failed to delete file from Dropbox: ${error.message}`);
      }
    }, dropboxPath);
  }

  async getTemporaryLink(dropboxPath) {
    return this.executeWithRetry(async (dropboxPath) => {
      try {
        console.log('🔗 Getting temporary link with Path-Root header for team folder access');
        
        // Use raw HTTP request with Path-Root header for team folder access
        const pathRootHeader = JSON.stringify({
          '.tag': 'root',
          'root': this.rootNamespaceId
        });
        
        const response = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.currentAccessToken}`,
            'Dropbox-API-Path-Root': pathRootHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ path: dropboxPath })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const result = await response.json();
        console.log('✅ Temporary link generated for team folder file');
        return result.link;
      } catch (error) {
        console.error('❌ Error getting temporary link:', error);
        throw new Error(`Failed to get temporary link: ${error.message}`);
      }
    }, dropboxPath);
  }

  async listFiles(folderPath = '/SnapTag', recursive = false) {
    return this.executeWithRetry(async (folderPath, recursive) => {
      try {
        console.log('📂 Listing files with Path-Root header for team folder access');
        
        // Use raw HTTP request with Path-Root header for team folder access
        const pathRootHeader = JSON.stringify({
          '.tag': 'root',
          'root': this.rootNamespaceId
        });
        
        const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.currentAccessToken}`,
            'Dropbox-API-Path-Root': pathRootHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            path: folderPath,
            recursive,
            include_media_info: true,
            include_deleted: false,
            include_has_explicit_shared_members: false
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const result = await response.json();
        console.log('✅ File list retrieved from team folder');
        return result.entries;
      } catch (error) {
        console.error('❌ Error listing files:', error);
        throw new Error(`Failed to list files: ${error.message}`);
      }
    }, folderPath, recursive);
  }

  async createFolder(folderPath) {
    return this.executeWithRetry(async (folderPath) => {
      try {
        const response = await this.dbx.filesCreateFolderV2({
          path: folderPath,
          autorename: false
        });
        
        console.log(`📁 Folder created: ${folderPath}`);
        return response.result;
      } catch (error) {
        if (error.error && error.error.error_summary && error.error.error_summary.includes('path/conflict/folder/')) {
          console.log(`📁 Folder already exists: ${folderPath}`);
          return { path: { display: folderPath } };
        }
        console.error('❌ Error creating folder:', error);
        throw new Error(`Failed to create folder: ${error.message}`);
      }
    }, folderPath);
  }

  async getFileMetadata(dropboxPath) {
    return this.executeWithRetry(async (dropboxPath) => {
      try {
        const response = await this.dbx.filesGetMetadata({
          path: dropboxPath,
          include_media_info: true,
          include_deleted: false,
          include_has_explicit_shared_members: false
        });

        return response.result;
      } catch (error) {
        console.error('❌ Error getting file metadata:', error);
        throw new Error(`Failed to get file metadata: ${error.message}`);
      }
    }, dropboxPath);
  }

  async searchFiles(query, folderPath = '/SnapTag') {
    return this.executeWithRetry(async (query, folderPath) => {
      try {
        const response = await this.dbx.filesSearchV2({
          query,
          options: {
            path: folderPath,
            max_results: 100,
            file_status: 'active',
            filename_only: false
          }
        });

        return response.result.matches.map(match => match.metadata.metadata);
      } catch (error) {
        console.error('❌ Error searching files:', error);
        throw new Error(`Failed to search files: ${error.message}`);
      }
    }, query, folderPath);
  }

  async initializeSnapTagFolder() {
    try {
      await this.createFolder('/SnapTag');
      console.log('📁 SnapTag folder initialized');
    } catch (error) {
      console.error('❌ Error initializing SnapTag folder:', error);
    }
  }

  // Health check method
  async testConnection() {
    return this.executeWithRetry(async () => {
      try {
        const response = await this.dbx.usersGetCurrentAccount();
        console.log(`✅ Dropbox connection successful for: ${response.result.name.display_name}`);
        return true;
      } catch (error) {
        console.error('❌ Dropbox connection test failed:', error);
        return false;
      }
    });
  }
}

module.exports = new DropboxService(); 