module.exports = function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy("src/resources");
    eleventyConfig.addPassthroughCopy("src/README.md");

    // Create blog posts collection
    eleventyConfig.addCollection("blogPosts", function(collectionApi) {
        return collectionApi.getFilteredByGlob("src/blog-posts/*.md").sort((a, b) => {
            return new Date(b.data.date) - new Date(a.data.date);
        });
    });

    // Create tags collection
    eleventyConfig.addCollection("blogTags", function(collectionApi) {
        let tagSet = new Set();
        collectionApi.getFilteredByGlob("src/blog-posts/*.md").forEach(item => {
            if (item.data.tags) {
                item.data.tags.forEach(tag => tagSet.add(tag));
            }
        });
        return [...tagSet].sort();
    });

    // Add slugify filter
    eleventyConfig.addFilter("slugify", function(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove non-word chars
            .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    });

    // Add date filter for blog posts
    eleventyConfig.addFilter("dateFormat", function(date) {
        return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(new Date(date));
    });

    // Add excerpt filter
    eleventyConfig.addFilter("excerpt", function(content, length = 200) {
        const text = content.replace(/<[^>]*>/g, '');
        return text.length > length ? text.substring(0, length) + '...' : text;
    });

    // Add slice filter for arrays
    eleventyConfig.addFilter("slice", function(array, start, end) {
        return array.slice(start, end);
    });

    // Add reverse filter for arrays
    eleventyConfig.addFilter("reverse", function(array) {
        return [...array].reverse();
    });

    // Add selectattr filter for filtering by attribute
    eleventyConfig.addFilter("selectattr", function(array, attr, value) {
        return array.filter(item => {
            const attrValue = attr.split('.').reduce((obj, key) => obj && obj[key], item);
            if (typeof value === 'string') {
                return attrValue && attrValue.includes && attrValue.includes(value);
            }
            return attrValue === value;
        });
    });

    // Add contains filter
    eleventyConfig.addFilter("contains", function(array, value) {
        return array && array.includes && array.includes(value);
    });
  
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