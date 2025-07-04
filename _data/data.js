const fs = require("fs");
const path = require("path");
const { authorize, getVersionInfo } = require("./backblaze-version-fetcher");

module.exports = async () => {
  const jsonPath = path.join(__dirname, "..", "src", "resources", "json", "data.json");
  const json = fs.readFileSync(jsonPath, "utf8");
  console.log("Loaded JSON from:", jsonPath);
  
  const data = JSON.parse(json);
  
  // Initialize Backblaze version fetcher
  const isAuthorized = await authorize();
  
  if (isAuthorized) {
    console.log("Fetching version information for screenplay files...");
    
    // Process each item to add version information
    for (const item of data) {
      if (item.versioning === "Yes" && item.PDFSrc && item.PDFSrc.includes('files.itsjonathanthompson.com')) {
        try {
          const versionInfo = await getVersionInfo(item.PDFSrc);
          item.versionInfo = versionInfo;
          
          if (versionInfo.hasVersions) {
            console.log(`Found ${versionInfo.totalVersions} versions for: ${item.title}`);
          }
        } catch (error) {
          console.warn(`Failed to get version info for ${item.title}:`, error.message);
          item.versionInfo = { hasVersions: false, currentVersion: null, totalVersions: 0 };
        }
      }
    }
    
    console.log("Version information fetching complete.");
  } else {
    console.log("Skipping version information fetching - Backblaze not configured.");
  }
  
  return data;
};