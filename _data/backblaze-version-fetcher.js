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
    
    console.log(`Searching for file versions with prefix: "${fileName}"`);
    
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
    
    console.log(`Found ${data.files.length} files matching prefix`);
    
    // Filter to exact file name matches and sort by upload timestamp
    const fileVersions = data.files
      .filter(file => {
        const matches = file.fileName === fileName && file.action === 'upload';
        if (matches) {
          console.log(`Exact match found: ${file.fileName}`);
        }
        return matches;
      })
      .sort((a, b) => parseInt(a.uploadTimestamp) - parseInt(b.uploadTimestamp));
    
    console.log(`Found ${fileVersions.length} exact matches for: "${fileName}"`);
    
    return fileVersions;
  } catch (error) {
    console.warn(`Failed to get versions for ${fileName}:`, error.message);
    return null;
  }
}

// Fixed URL parsing function
function parseFileUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Get the pathname and remove leading slash
    const pathname = urlObj.pathname.substring(1);
    
    // Properly decode URL components, handling both %20 and + for spaces
    const fullPath = decodeURIComponent(pathname.replace(/\+/g, ' '));
    
    // Extract filename
    const pathParts = fullPath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    console.log(`Parsed URL: ${url}`);
    console.log(`  - Full path: "${fullPath}"`);
    console.log(`  - File name: "${fileName}"`);
    
    return { fullPath, fileName };
  } catch (error) {
    console.warn(`Failed to parse URL: ${url}`, error.message);
    
    // Fallback to original method
    const urlParts = url.split('/');
    const fileName = decodeURIComponent(urlParts[urlParts.length - 1].replace(/\+/g, ' '));
    const fullPath = urlParts.slice(3).map(part => decodeURIComponent(part.replace(/\+/g, ' '))).join('/');
    
    return { fullPath, fileName };
  }
}

async function getVersionInfo(url) {
  // Use improved URL parsing
  const { fullPath, fileName } = parseFileUrl(url);
  
  const versions = await getFileVersions(fullPath);
  
  if (!versions || versions.length === 0) {
    // If we can't find the file through the API but the URL exists and points to our domain,
    // we'll assume it exists as v1 (this handles cases where the file exists but path matching fails)
    if (url.includes('files.itsjonathanthompson.com')) {
      console.log(`No versions found for ${fullPath}, using fallback`);
      return {
        hasVersions: true,
        currentVersion: 1,
        totalVersions: 1,
        versions: [{
          version: 1,
          uploadDate: new Date(), // Use current date as fallback
          fileId: null
        }]
      };
    }
    
    return {
      hasVersions: false,
      currentVersion: null,
      totalVersions: 0
    };
  }

  // Even single files should be treated as v1
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
  getVersionInfo,
  parseFileUrl // Export for testing
};
