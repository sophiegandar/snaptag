const { Dropbox } = require('dropbox');
const fs = require('fs').promises;
const https = require('https');
const querystring = require('querystring');

class DropboxService {
  constructor() {
    this.currentAccessToken = process.env.DROPBOX_ACCESS_TOKEN;
    this.refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    this.appKey = process.env.DROPBOX_APP_KEY;
    this.appSecret = process.env.DROPBOX_APP_SECRET;
    
    this.dbx = new Dropbox({ 
      accessToken: this.currentAccessToken,
      fetch: fetch // Use global fetch in Node.js 18+
    });

    console.log('🔧 Dropbox Service initialized');
    console.log(`   Has Access Token: ${!!this.currentAccessToken}`);
    console.log(`   Has Refresh Token: ${!!this.refreshToken}`);
    console.log(`   Has App Credentials: ${!!(this.appKey && this.appSecret)}`);
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
        fetch: fetch
      });

      console.log('✅ Access token refreshed successfully');
      return this.currentAccessToken;

    } catch (error) {
      console.error('❌ Error refreshing access token:', error.message);
      throw error;
    }
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
      // Check if it's an authentication error
      if (error.status === 401 || (error.error && error.error.error_summary && error.error.error_summary.includes('invalid_access_token'))) {
        console.log('🔄 Access token expired, attempting refresh...');
        
        try {
          await this.refreshAccessToken();
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

  async uploadFile(localFilePath, dropboxPath) {
    return this.executeWithRetry(async (localFilePath, dropboxPath) => {
      try {
        const fileBuffer = await fs.readFile(localFilePath);
        
        const response = await this.dbx.filesUpload({
          path: dropboxPath,
          contents: fileBuffer,
          mode: 'add',
          autorename: true
        });

        console.log(`📤 File uploaded to Dropbox: ${dropboxPath}`);
        return response.result;
      } catch (error) {
        console.error('❌ Error uploading to Dropbox:', error);
        throw new Error(`Failed to upload file to Dropbox: ${error.message}`);
      }
    }, localFilePath, dropboxPath);
  }

  async downloadFile(dropboxPath, localFilePath) {
    return this.executeWithRetry(async (dropboxPath, localFilePath) => {
      try {
        const response = await this.dbx.filesDownload({ path: dropboxPath });
        
        // Handle different response formats from Dropbox SDK
        let fileData;
        if (response.result.fileBinary) {
          fileData = response.result.fileBinary;
        } else if (response.fileBinary) {
          fileData = response.fileBinary;
        } else if (response.result && typeof response.result === 'object') {
          // Try to get buffer from the response
          fileData = Buffer.from(await response.result.arrayBuffer());
        } else {
          throw new Error('Unable to extract file data from Dropbox response');
        }
        
        await fs.writeFile(localFilePath, fileData);
        console.log(`📥 File downloaded from Dropbox: ${dropboxPath}`);
        
        return localFilePath;
      } catch (error) {
        console.error('❌ Error downloading from Dropbox:', error);
        console.error('❌ Response structure:', JSON.stringify(Object.keys(error.response || {}), null, 2));
        throw new Error(`Failed to download file from Dropbox: ${error.message}`);
      }
    }, dropboxPath, localFilePath);
  }

  async deleteFile(dropboxPath) {
    return this.executeWithRetry(async (dropboxPath) => {
      try {
        const response = await this.dbx.filesDeleteV2({ path: dropboxPath });
        console.log(`🗑️ File deleted from Dropbox: ${dropboxPath}`);
        return response.result;
      } catch (error) {
        console.error('❌ Error deleting from Dropbox:', error);
        throw new Error(`Failed to delete file from Dropbox: ${error.message}`);
      }
    }, dropboxPath);
  }

  async getTemporaryLink(dropboxPath) {
    return this.executeWithRetry(async (dropboxPath) => {
      try {
        const response = await this.dbx.filesGetTemporaryLink({ path: dropboxPath });
        return response.result.link;
      } catch (error) {
        console.error('❌ Error getting temporary link:', error);
        throw new Error(`Failed to get temporary link: ${error.message}`);
      }
    }, dropboxPath);
  }

  async listFiles(folderPath = '/SnapTag', recursive = false) {
    return this.executeWithRetry(async (folderPath, recursive) => {
      try {
        const response = await this.dbx.filesListFolder({
          path: folderPath,
          recursive,
          include_media_info: true,
          include_deleted: false,
          include_has_explicit_shared_members: false
        });

        return response.result.entries;
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