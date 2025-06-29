# Blog System Guide

This portfolio website now includes a comprehensive blog system built with Eleventy. Here's how to manage and add new blog content.

## Quick Start

### Adding a New Blog Post

1. Create a new `.md` file in the `/src/blog-posts/` directory
2. Use this frontmatter template:

```yaml
---
title: "Your Blog Post Title"
date: 2024-12-20
tags: ["tag1", "tag2", "tag3"]
excerpt: "A brief description of your post that will appear in listings."
permalink: "/blog/posts/{{ title | slugify }}/"
layout: "blog-post.njk"
---
```

3. Write your content using standard Markdown syntax
4. The post will automatically appear on your blog!

### Available Tags

Current tag categories include:
- `editorial` - Post-production and editing topics
- `production` - On-set and production topics  
- `writing` - Screenwriting and narrative development
- `cinematography` - Camera work and visual storytelling
- `sound-design` - Audio and sound topics
- `post-production` - General post-production topics
- `collaboration` - Working with teams and industry insights
- `color-grading` - Color correction and grading
- `storytelling` - General storytelling techniques
- `workflow` - Process and efficiency topics

You can create new tags by simply using them in your post frontmatter.

## Blog Structure

### Main Blog Page (`/blog/`)
- Shows the 4 most recent posts
- Features navigation to view all posts and browse by tags
- Includes functional category links

### All Posts (`/blog/posts/`)
- Paginated list of all blog posts (8 per page)
- Shows posts in reverse chronological order
- Includes pagination controls when needed

### Tags Index (`/blog/tags/`)
- Lists all available tags with post counts
- Shows preview of recent posts for each tag
- Provides easy navigation to tag-specific pages

### Individual Tag Pages (`/blog/tags/[tag-name]/`)
- Shows all posts for a specific tag
- Maintains chronological ordering
- Includes navigation back to main blog areas

### Individual Post Pages (`/blog/posts/[post-slug]/`)
- Full post content with proper formatting
- Tag navigation and metadata
- Back links to main blog areas

## Development Commands

```bash
# Build the site
npm run build

# Start development server with auto-rebuild
npm run serve
# or
npm run dev

# Clean and rebuild
npm run prebuild && npm run build
```

## Writing Tips

### Frontmatter Fields

- **title**: The main title of your post
- **date**: Publication date (YYYY-MM-DD format)
- **tags**: Array of relevant tags for categorization
- **excerpt**: Brief description for post listings (optional but recommended)
- **permalink**: Auto-generated URL structure (keep as shown)
- **layout**: Template to use (keep as "blog-post.njk")

### Markdown Features

The blog supports standard Markdown including:
- Headers (`#`, `##`, `###`, etc.)
- **Bold** and *italic* text
- Lists (ordered and unordered)
- Links `[text](url)`
- Images `![alt](src)`
- Code blocks with syntax highlighting
- Blockquotes
- Tables

### SEO Considerations

- Use descriptive titles
- Include relevant tags
- Write compelling excerpts
- Use proper heading hierarchy
- Add alt text to images

## File Organization

```
src/
├── blog-posts/           # Your markdown blog posts go here
│   ├── post-1.md
│   ├── post-2.md
│   └── ...
├── blog.njk             # Main blog page template
├── blog-posts-list.njk  # All posts listing page
├── blog-tags.njk        # Tags index page
├── blog-tag.njk         # Individual tag page template
└── templates/
    └── blog-post.njk    # Individual post template
```

## Customization

### Adding New Tag Categories

Simply use new tag names in your post frontmatter. The system will automatically:
- Create tag pages
- Update the tags index
- Include posts in navigation

### Modifying Post Display

- Edit `/src/templates/blog-post.njk` for individual post layout
- Edit `/src/blog.njk` for main blog page
- Modify CSS in `/src/resources/css/blog.css`

### Changing Pagination

In the blog posts list template (`blog-posts-list.njk`), modify the `size: 8` value in the frontmatter to change how many posts appear per page.

## Deployment

The blog system generates static HTML files that work with any web server. The generated files will be in the `_site/` directory after running `npm run build`.

## Content Guidelines

### Writing Style
- Keep posts focused on filmmaking topics
- Use clear, engaging headlines
- Include practical examples and techniques
- Maintain consistency with your professional voice

### Technical Content
- Explain technical concepts clearly
- Include relevant workflow tips
- Share personal experiences and insights
- Consider your audience's skill level

---

*This blog system is designed to be simple, SEO-friendly, and easy to maintain. Just add markdown files and the system handles the rest!*
