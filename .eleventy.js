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

    // Create collection for tag pagination data
    eleventyConfig.addCollection("tagPaginationData", function(collectionApi) {
        const posts = collectionApi.getFilteredByGlob("src/blog-posts/*.md").sort((a, b) => {
            return new Date(b.data.date) - new Date(a.data.date);
        });
        
        let tagSet = new Set();
        posts.forEach(post => {
            if (post.data.tags) {
                post.data.tags.forEach(tag => tagSet.add(tag));
            }
        });
        
        let paginationData = [];
        const pageSize = 8;
        
        [...tagSet].forEach(tag => {
            const tagPosts = posts.filter(post => 
                post.data.tags && post.data.tags.includes(tag)
            );
            
            const totalPages = Math.ceil(tagPosts.length / pageSize);
            
            for (let pageNum = 0; pageNum < totalPages; pageNum++) {
                const startIndex = pageNum * pageSize;
                const endIndex = startIndex + pageSize;
                const pagePosts = tagPosts.slice(startIndex, endIndex);
                
                paginationData.push({
                    tag: tag,
                    pageNumber: pageNum,
                    posts: pagePosts,
                    totalPages: totalPages,
                    totalPosts: tagPosts.length
                });
            }
        });
        
        return paginationData;
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
        // Handle timezone issues by treating dates as local dates
        let dateObj;
        if (typeof date === 'string') {
            // If it's a YYYY-MM-DD string, treat it as local date
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = date.split('-').map(Number);
                dateObj = new Date(year, month - 1, day); // month is 0-indexed
            } else {
                dateObj = new Date(date);
            }
        } else {
            dateObj = new Date(date);
        }
        
        return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "2-digit"
        }).format(dateObj);
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
    eleventyConfig.addFilter("selectattr", function(array, attr, operation, value) {
        return array.filter(item => {
            const attrValue = attr.split('.').reduce((obj, key) => obj && obj[key], item);
            
            if (operation === 'contains') {
                return attrValue && Array.isArray(attrValue) && attrValue.includes(value);
            }
            
            if (typeof value === 'string' && attrValue && attrValue.includes) {
                return attrValue.includes(value);
            }
            
            return attrValue === value;
        });
    });

    // Add contains filter
    eleventyConfig.addFilter("contains", function(array, value) {
        return array && array.includes && array.includes(value);
    });
  
    // Add title case filter - preserves intentional capitalization
    eleventyConfig.addFilter("titleCase", function(str) {
        // If the string has mixed case (indicating intentional formatting), preserve it
        if (str !== str.toLowerCase() && str !== str.toUpperCase()) {
            return str;
        }
        
        // Otherwise, apply title case for all-lowercase or all-uppercase strings
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    });

    // Add range filter for pagination
    eleventyConfig.addFilter("range", function(start, end) {
        const result = [];
        for (let i = start; i < end; i++) {
            result.push(i);
        }
        return result;
    });

    // Add reading time filter
    eleventyConfig.addFilter("readingTime", function(content) {
        if (!content) return 1;
        
        // Strip HTML tags and count words
        const text = content.replace(/<[^>]*>/g, '');
        const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        
        // Calculate reading time based on 200 words per minute
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        
        return readingTime;
    });

    // Add copyright year filter for automatic year updates
    eleventyConfig.addFilter("copyrightYear", function() {
        const currentYear = new Date().getFullYear();
        const startYear = 2024; // The year the website was created
        
        if (currentYear > startYear) {
            return `${startYear}-${currentYear}`;
        } else {
            return `${startYear}`;
        }
    });

    // Add sortByDate filter to sort data by date (newest first)
    eleventyConfig.addFilter("sortByDate", function(array) {
        if (!array || !Array.isArray(array)) return [];
        
        return [...array].sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA; // Newest first (descending order)
        });
    });

    // Add filter to process newlines in descriptions
    eleventyConfig.addFilter("processNewlines", function(text) {
        if (!text) return '';
        return text.replace(/\n/g, '<br>');
    });

    // Add filter to process URLs and newlines in descriptions (for project pages)
    eleventyConfig.addFilter("processDescriptionLinks", function(text) {
        if (!text) return '';
        
        // First, process newlines
        let processed = text.replace(/\n/g, '<br>');
        
        // Then, detect and wrap URLs in <a> tags
        // This regex detects URLs starting with http, https, or www
        const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+)/gi;
        
        processed = processed.replace(urlRegex, function(url) {
            // Add protocol if missing
            const href = url.startsWith('http') ? url : `https://${url}`;
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
        
        return processed;
    });

    // Add transform to process video links in blog posts
    eleventyConfig.addTransform("processVideoLinks", function(content, outputPath) {
        // Only process HTML files from blog posts
        if (outputPath && outputPath.includes('/blog/posts/') && outputPath.endsWith('.html')) {
            // Process videoLink: [url] patterns
            const videoLinkRegex = /videoLink:\s*\[([^\]]+)\]/g;
            
            content = content.replace(videoLinkRegex, (match, url) => {
                return createVideoEmbed(url.trim());
            });
        }
        return content;
    });

    // Helper function to create video embeds
    function createVideoEmbed(url, width = '70%') {
        // YouTube regex
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        // Vimeo regex  
        const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/i;

        let embedUrl = '';
        let platform = '';

        // Check for YouTube
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch) {
            embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
            platform = 'YouTube';
        }

        // Check for Vimeo
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
            platform = 'Vimeo';
        }

        // Fallback for direct embed URLs
        if (!embedUrl && url.includes('embed')) {
            embedUrl = url;
            platform = 'Video';
        }

        if (embedUrl) {
            return `
            <div class="video-embed" style="width:${width};" id="player" role="region" aria-label="Embedded ${platform} video">
                <div class="player">
                    <iframe
                        src="${embedUrl}"
                        title="Embedded ${platform} video"
                        aria-label="Embedded ${platform} video"
                        allowfullscreen
                        allowtransparency
                        allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        loading="lazy"
                        tabindex="0"
                    ></iframe>
                </div>
            </div>`;
        }

        // Return original if no match found
        return `videoLink: [${url}]`;
    }

    return {
      templateFormats: ["njk", "html", "md"],
      markdownTemplateEngine: "njk",
      htmlTemplateEngine: "njk",
      dataTemplateEngine: "njk",
      dir: {
        input: "./src",        // source folder
        output: "_site",   // default build folder
        data: "../_data", // default data folder
        includes: "templates", // default includes folder
      }
    };
  };