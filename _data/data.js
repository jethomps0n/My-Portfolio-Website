const fs = require("fs");
const path = require("path");

module.exports = () => {
  const jsonPath = path.join(__dirname, "..", "src", "resources", "json", "data.json");
  const json = fs.readFileSync(jsonPath, "utf8");
  console.log("Loaded JSON from:", jsonPath);
  return JSON.parse(json);
};