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

// Parse Backblaze custom metadata date format (MM-DD-YY) into UTC timestamp.
function parseOriginalUploadDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const match = dateString.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const yearShort = parseInt(match[3], 10);
  const year = yearShort >= 70 ? 1900 + yearShort : 2000 + yearShort;

  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  // Validate to avoid JS date rollover (e.g. 02-31-24).
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate.getTime();
}

function getVersionTimestamp(fileVersion) {
  const originalUploadDate =
    fileVersion?.original_upload_date || fileVersion?.fileInfo?.original_upload_date;
  const parsedOriginalUploadDate = parseOriginalUploadDate(originalUploadDate);
  if (parsedOriginalUploadDate !== null) {
    return parsedOriginalUploadDate;
  }

  const uploadTimestamp = parseInt(fileVersion?.uploadTimestamp, 10);
  return Number.isNaN(uploadTimestamp) ? null : uploadTimestamp;
}

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
    
    // Filter to exact file name matches and sort by original_upload_date first,
    // then fallback to uploadTimestamp when original_upload_date is unavailable.
    const fileVersions = data.files
      .filter(file => {
        const matches = file.fileName === fileName && file.action === 'upload';
        if (matches) {
          console.log(`Exact match found: ${file.fileName}`);
        }
        return matches;
      })
      .sort((a, b) => {
        const aTimestamp = getVersionTimestamp(a);
        const bTimestamp = getVersionTimestamp(b);

        if (aTimestamp === null && bTimestamp === null) {
          return 0;
        }
        if (aTimestamp === null) {
          return -1;
        }
        if (bTimestamp === null) {
          return 1;
        }

        return aTimestamp - bTimestamp;
      });
    
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
    versions: versions.map((version, index) => {
      const versionTimestamp = getVersionTimestamp(version);
      return {
        version: index + 1,
        uploadDate: versionTimestamp !== null ? new Date(versionTimestamp) : new Date(),
        fileId: version.fileId
      };
    })
  };
}

module.exports = {
  authorize,
  getVersionInfo,
  parseFileUrl // Export for testing
};
