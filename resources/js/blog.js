// Blog Page JavaScript - Following the design philosophy with INP optimizations

document.addEventListener('DOMContentLoaded', () => {
    // Initialize blog page elements with scheduler prioritization
    scheduler.postTask(() => {
        initializeBlogPage();
    }, { priority: 'user-blocking' });
    
    // Setup scroll animations with lower priority
    scheduler.postTask(() => {
        setupScrollAnimations();
    }, { priority: 'user-visible' });
    
    // Add interactive enhancements with background priority
    scheduler.postTask(() => {
        addInteractiveEffects();
        setupCategoryNavigation();
    }, { priority: 'background' });
});

function initializeBlogPage() {
    // Remove pop-in classes after animation completes (matching site pattern)
    const popInElements = document.querySelectorAll('.pop-in');
    popInElements.forEach(el => {
        el.addEventListener('animationend', () => el.classList.remove('pop-in'), {once: true, passive: true});
    });
    
    // Stagger animations for blog sections with batching
    staggerAnimations();
    
    // Handle smart grid positioning for blog navigation
    handleBlogNavigationPositioning();
}

async function staggerAnimations() {
    const sections = document.querySelectorAll('.blog-section');
    const posts = document.querySelectorAll('.blog-post');
    
    // Batch DOM style updates for better performance
    await scheduler.postTask(() => {
        sections.forEach((section, index) => {
            section.style.animationDelay = `${index * 0.1}s`;
        });
    }, { priority: 'user-visible' });
    
    // Stagger blog post animations with yielding
    await scheduler.postTask(() => {
        posts.forEach((post, index) => {
            post.style.opacity = '0';
            post.style.transform = 'translateY(20px)';
            post.style.transition = 'all 0.4s ease';
            post.style.animationDelay = `${index * 0.1}s`;
            
            // Use requestAnimationFrame for smooth animations
            setTimeout(() => {
                requestAnimationFrame(() => {
                    post.style.opacity = '1';
                    post.style.transform = 'translateY(0)';
                });
            }, 200 + (index * 100));
        });
    }, { priority: 'user-visible' });
}

function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Observe upcoming topics and category tags (but not navigation category tags)
    document.querySelectorAll('.topic-preview, .category-tag:not(.categories-strip .category-tag)').forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = 'all 0.4s ease';
        observer.observe(item);
    });
}

function addInteractiveEffects() {
    // Add ripple effect to CTA buttons (matching site pattern)
    const ctaButtons = document.querySelectorAll('.cta-button');
    ctaButtons.forEach(button => {
        button.addEventListener('click', createRippleEffect);
    });
    
    // Enhanced hover effects for blog posts
    setupBlogPostEffects();
    
    // Category tag interactions
    setupCategoryTagEffects();
    
    // Social link enhancements
    setupSocialLinkEffects();
}

function createRippleEffect(e) {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
        animation: blogRipple 0.6s ease-out;
    `;
    
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
}

function setupBlogPostEffects() {
    const blogPosts = document.querySelectorAll('.blog-post');
    
    blogPosts.forEach(post => {
        // Enhanced click tracking
        post.addEventListener('click', (e) => {
            if (e.target.closest('.read-more')) {
                trackBlogInteraction('read_more_click', post.querySelector('h3').textContent);
            }
        });
    });
}

function setupCategoryTagEffects() {
    // Only apply effects to non-navigation category tags
    const categoryTags = document.querySelectorAll('.category-tag:not(.categories-strip .category-tag)');
    
    categoryTags.forEach(tag => {
        tag.addEventListener('mouseenter', () => {
            // Create subtle pulse effect
            tag.style.animation = 'pulse 1.5s infinite';
        });
        
        tag.addEventListener('mouseleave', () => {
            tag.style.animation = '';
        });
        
        tag.addEventListener('click', (e) => {
            // Only prevent default for non-navigation category tags
            if (!tag.href || tag.href.includes('#')) {
                e.preventDefault();
                const category = tag.textContent.toLowerCase().replace(/\s+/g, '-');
                filterByCategory(category);
                trackBlogInteraction('category_click', category);
            }
            // Let normal navigation links work naturally
        });
    });
}

function setupSocialLinkEffects() {
    const socialLinks = document.querySelectorAll('.social-link');
    
    socialLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            const icon = link.querySelector('.social-icon');
            if (icon) {
                icon.style.transform = 'scale(1.2) rotate(5deg)';
                icon.style.transition = 'transform 200ms ease';
            }
        });
        
        link.addEventListener('mouseleave', () => {
            const icon = link.querySelector('.social-icon');
            if (icon) {
                icon.style.transform = '';
            }
        });
    });
}

function setupCategoryNavigation() {
    // Future enhancement: implement category filtering
    // For now, just smooth scrolling to sections
    
    const categoryLinks = document.querySelectorAll('a[href^="#"]');
    categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function filterByCategory(category) {
    // Placeholder for future category filtering functionality
    console.log(`Filtering by category: ${category}`);
    
    // Could implement:
    // - Hide/show relevant posts
    // - Update URL hash
    // - Animate transitions
    // - Show filtered state indicator
}

function trackBlogInteraction(action, data) {
    // Analytics tracking (placeholder)
    console.log(`Blog interaction: ${action}`, data);
    
    // You can integrate with analytics services here
    // gtag('event', action, { event_category: 'blog', event_label: data });
}

// Add typing animation for blog title
function animateBlogTitle() {
    const title = document.querySelector('.blog-title');
    if (!title) return;
    
    const text = title.textContent;
    title.textContent = '';
    title.style.borderRight = '2px solid hsla(242, 61%, 80%, 1)';
    
    let i = 0;
    const typeInterval = setInterval(() => {
        title.textContent += text.charAt(i);
        i++;
        
        if (i >= text.length) {
            clearInterval(typeInterval);
            setTimeout(() => {
                title.style.borderRight = 'none';
            }, 500);
        }
    }, 100);
}

// Enhanced reading time calculation
function calculateReadingTime() {
    // Handle individual blog post page
    const singlePost = document.querySelector('.blog-post-single');
    if (singlePost) {
        // Check if reading time already exists in post meta
        const existingReadingTime = singlePost.querySelector('.reading-time');
        if (existingReadingTime) return; // Exit if already present
        
        const content = singlePost.querySelector('.post-content');
        if (content) {
            const wordCount = content.textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
            const readingTime = Math.max(1, Math.ceil(wordCount / 200)); // Minimum 1 min, assume 200 WPM
            
            const readingTimeElement = document.createElement('span');
            readingTimeElement.className = 'reading-time';
            readingTimeElement.textContent = `${readingTime} min read`;
            readingTimeElement.style.cssText = `
                color: hsla(0, 0%, 70%, 1);
                font-size: 0.85rem;
                margin-left: 12px;
                opacity: 0.8;
            `;
            
            const postMeta = singlePost.querySelector('.post-meta');
            if (postMeta) {
                postMeta.appendChild(readingTimeElement);
            }
        }
        return; // Exit early for single post page
    }
    
    // For blog listing pages, reading times are now pre-calculated by Eleventy
    // No need to estimate - they're already included in the templates
    console.log('Reading times are pre-calculated by Eleventy for blog listings');
}

// Theme-aware time-based greeting
function addTimeBasedGreeting() {
    const hero = document.querySelector('#blog-hero .hero-content');
    if (!hero) return;
    
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour < 12) {
        greeting = '🌅 Good morning, fellow storyteller';
    } else if (hour < 17) {
        greeting = '☀️ Good afternoon, creative mind';
    } else {
        greeting = '🌙 Good evening, visual artist';
    }
    
    const greetingElement = document.createElement('p');
    greetingElement.textContent = greeting;
    greetingElement.style.cssText = `
        font-size: 0.9rem;
        color: hsla(242, 61%, 80%, 0.8);
        margin: 10px 0 0 0;
        opacity: 0;
        animation: fadeInUp 0.6s ease-out 0.5s forwards;
    `;
    
    hero.appendChild(greetingElement);
}

// Add custom animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes blogRipple {
        from {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
        }
        to {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
        }
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .animate-in {
        animation: fadeInUp 0.4s ease-out;
    }
`;
document.head.appendChild(style);

// Handle smart positioning of blog navigation within grid
function handleBlogNavigationPositioning() {
    const blogGrid = document.querySelector('.blog-grid');
    const blogNavigation = document.querySelector('.blog-navigation');
    
    if (!blogGrid || !blogNavigation) return;
    
    const positionNavigation = () => {
        const posts = blogGrid.querySelectorAll('.blog-post');
        const gridComputedStyle = window.getComputedStyle(blogGrid);
        const gridTemplateColumns = gridComputedStyle.gridTemplateColumns;
        const columns = gridTemplateColumns.split(' ').length;
        
        // Calculate if there's space in the grid
        const totalPosts = posts.length;
        const fullRows = Math.floor(totalPosts / columns);
        const remainingSpots = totalPosts % columns;
        const availableSpots = columns - remainingSpots;
        
        // If there are available spots in the last row and we have at least 2 columns
        if (availableSpots > 0 && availableSpots < columns && columns >= 2) {
            // Move navigation into the grid
            blogNavigation.classList.add('in-grid');
            blogNavigation.classList.remove('outside-grid');
            
            // Insert navigation after the last post in the grid
            const lastPost = posts[posts.length - 1];
            if (lastPost && lastPost.parentNode === blogGrid) {
                blogGrid.insertBefore(blogNavigation, lastPost.nextSibling);
            }
        } else {
            // Keep navigation outside the grid
            blogNavigation.classList.remove('in-grid');
            blogNavigation.classList.add('outside-grid');
            
            // Move navigation after the grid
            if (blogNavigation.parentNode === blogGrid) {
                blogGrid.parentNode.insertBefore(blogNavigation, blogGrid.nextSibling);
            }
        }
    };
    
    // Position on load
    positionNavigation();
    
    // Reposition on window resize (debounced)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(positionNavigation, 250);
    });
}

// Initialize enhanced features after page load
window.addEventListener('load', () => {
    calculateReadingTime();
    addTimeBasedGreeting();
    
    // Optional: animate blog title (comment out if too distracting)
    // animateBlogTitle();
});

// Mouse cursor integration (if mouse-follower is available)
if (typeof cursor !== 'undefined') {
    const interactiveElements = document.querySelectorAll('.cta-button, .category-tag, .social-link, .read-more');
    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            cursor.addState('-pointer');
        });
        
        element.addEventListener('mouseleave', () => {
            cursor.removeState('-pointer');
        });
    });
}
