// Try to use native fetch first, fallback to node-fetch
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) {
    fetch = require('node-fetch');
  }
} catch (error) {
  console.warn('Could not load fetch, version tracking will be disabled');
  fetch = null;
}
require('dotenv').config();

let authToken = null;
let apiUrl = null;
let downloadUrl = null;

async function authorize() {
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const key = process.env.B2_APPLICATION_KEY;
  
  if (!fetch) {
    console.warn('Fetch not available. Version info will not be available.');
    return false;
  }
  
  if (!keyId || !key) {
    console.warn('Backblaze credentials not found. Version info will not be available.');
    return false;
  }

  try {
    const auth = Buffer.from(`${keyId}:${key}`).toString('base64');
    
    const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status}`);
    }

    const data = await response.json();
    authToken = data.authorizationToken;
    apiUrl = data.apiUrl;
    downloadUrl = data.downloadUrl;
    
    return true;
  } catch (error) {
    console.warn('Failed to authorize with Backblaze:', error.message);
    return false;
  }
}

async function getFileVersions(fileName) {
  if (!authToken || !fetch) {
    return null;
  }

  try {
    const bucketId = process.env.B2_BUCKET_ID;
    const url = `${apiUrl}/b2api/v2/b2_list_file_versions?bucketId=${bucketId}&prefix=${encodeURIComponent(fileName)}&maxFileCount=100`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authToken
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error ${response.status}:`, errorText);
      throw new Error(`List versions failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Filter to exact file name matches and sort by upload timestamp
    const fileVersions = data.files
      .filter(file => file.fileName === fileName && file.action === 'upload')
      .sort((a, b) => parseInt(a.uploadTimestamp) - parseInt(b.uploadTimestamp));
    
    return fileVersions;
  } catch (error) {
    console.warn(`Failed to get versions for ${fileName}:`, error.message);
    return null;
  }
}

async function getVersionInfo(url) {
  // Extract filename from URL like https://files.itsjonathanthompson.com/screenplays/example.pdf
  const urlParts = url.split('/');
  const fileName = urlParts[urlParts.length - 1];
  const fullPath = urlParts.slice(3).join('/'); // Get path after domain
  
  const versions = await getFileVersions(fullPath);
  
  if (!versions || versions.length <= 1) {
    return {
      hasVersions: false,
      currentVersion: null,
      totalVersions: versions ? versions.length : 0
    };
  }

  // Find which version this specific URL represents
  // For now, assume it's the latest version unless we have a way to determine otherwise
  const currentVersionIndex = versions.length; // Latest version
  
  return {
    hasVersions: true,
    currentVersion: currentVersionIndex,
    totalVersions: versions.length,
    versions: versions.map((version, index) => ({
      version: index + 1,
      uploadDate: new Date(parseInt(version.uploadTimestamp)),
      fileId: version.fileId
    }))
  };
}

module.exports = {
  authorize,
  getVersionInfo
};
