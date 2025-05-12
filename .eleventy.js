module.exports = function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy("src/resources");
    eleventyConfig.addPassthroughCopy("README.md");
  
    return {
      templateFormats: ["njk", "html", "md"],
      markdownTemplateEngine: "njk",
      htmlTemplateEngine: "njk",
      dataTemplateEngine: "njk",
      dir: {
        input: "./src",        // your source folder
        output: "_site",   // default build folder
        data: "../_data", // default data folder
        includes: "templates", // default includes folder
      }
    };
  };