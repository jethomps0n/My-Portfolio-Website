const fs = require("fs");
const path = require("path");
const { authorize, getVersionInfo } = require("./backblaze-version-fetcher");

module.exports = async () => {
  const jsonPath = path.join(__dirname, "..", "src", "resources", "json", "data.json");
  const json = fs.readFileSync(jsonPath, "utf8");
  console.log("Loaded JSON from:", jsonPath);
  
  const data = JSON.parse(json);

  // Skip version fetching in development mode
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.SKIP_VERSION_FETCH === 'true';
  
  if (isDevelopment) {
    console.log("⚠️  DEVELOPMENT MODE: Skipping version fetching to preserve API limits");
    
    // Add fake version info for development
    for (const item of data) {
      if ((item.versioning === "Yes" || item.versioning === "Completed") && item.PDFSrc) {
        item.versionInfo = {
          hasVersions: true,
          currentVersion: 1,
          totalVersions: 1,
          versions: [{ uploadDate: item.date }]
        };
      }
    }
  } else {
    // Initialize Backblaze version fetcher
    const isAuthorized = await authorize();
    
    if (isAuthorized) {
      console.log("Fetching version information for screenplay files...");
      
      // Process each item to add version information
      for (const item of data) {
        if ((item.versioning === "Yes" || item.versioning === "Completed") && item.PDFSrc && item.PDFSrc.includes('files.itsjonathanthompson.com')) {
          try {
            const versionInfo = await getVersionInfo(item.PDFSrc);
            item.versionInfo = versionInfo;
            
            if (versionInfo.currentVersion) {
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

    // After processing all items, write the enhanced data to the _site directory
    const outputPath = path.join(__dirname, "..", "_site", "resources", "json", "data.json");
    const outputDir = path.dirname(outputPath);
    
    // Ensure the directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the processed data with version info
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log("Written processed data to:", outputPath);
  }
  
  return data;
};