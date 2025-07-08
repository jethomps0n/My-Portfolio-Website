document.addEventListener('DOMContentLoaded', () => {
    // Use scheduler for better prioritization of initialization tasks
    scheduler.postTask(() => {
        // Critical animations first
        document.querySelectorAll('.pop-in').forEach(el => {
            el.addEventListener('animationend', () => el.classList.remove('pop-in'), {once: true, passive: true});
        });
        
        animatePageElements();
    }, { priority: 'user-blocking' });
    
    // Secondary functionality with lower priority
    scheduler.postTask(() => {
        setupHoverEffects();
        setupSmoothScroll();
    }, { priority: 'user-visible' });
    
    // Background tasks with lowest priority
    scheduler.postTask(() => {
        setupScrollAnimations();
        processCharacterRoles();
        matchCreditsHeight();
        setupVersionHistory();
        
        // Process timestamps in description for video projects
        processDescriptionTimestamps();
    }, { priority: 'background' });
    
    // Setup resize handler with passive listener
    window.addEventListener('resize', () => {
        scheduler.postTask(() => {
            matchCreditsHeight();
        }, { priority: 'user-visible' });
    }, { passive: true });
});

async function processCharacterRoles() {
    // Find all credit name elements
    const creditNames = document.querySelectorAll('.credit-name');
    
    // Process in batches for better INP
    const BATCH_SIZE = 5;
    for (let i = 0; i < creditNames.length; i += BATCH_SIZE) {
        const batch = creditNames.slice(i, i + BATCH_SIZE);
        
        await scheduler.postTask(() => {
            batch.forEach(nameElement => {
                const text = nameElement.textContent;
                
                // Pattern to match " as [character name]" or " on [instrument/role]"
                // Must start with " as " or " on " and be followed by characters
                // This avoids matching names that end with "as" like "Matthias" or "on" like "Mason"
                const characterPattern = /(\s+(?:as|on)\s+[^,]+(?:\s*\([^)]+\))?)/gi;
                
                const matches = text.match(characterPattern);
                
                if (matches) {
                    let newHtml = text;
                    
                    // Replace each match with a styled span
                    matches.forEach(match => {
                        const trimmedMatch = match.trim(); // Remove extra whitespace
                        const styledMatch = ` <span class="character-role">${trimmedMatch}</span>`;
                        newHtml = newHtml.replace(match, styledMatch);
                    });
                    
                    nameElement.innerHTML = newHtml;
                }
            });
        }, { priority: 'background' });
    }
}

function matchCreditsHeight() {
    const project = document.getElementById('project');
    const credits = document.getElementById('credits');
    
    if (project && credits) {
        // Get the actual height of the project section
        const projectHeight = project.offsetHeight;
        
        // Set the credits height to match, but respect the max-height constraints
        const maxHeight = Math.min(
            projectHeight,
            window.innerHeight - 200 // Same as the CSS max-height calculation
        );
        
        credits.style.height = `${maxHeight}px`;
    }
}

function animatePageElements() {
    // Apply pop-in to main sections (matching your explore page timing)
    const contentBox = document.getElementById('content-box');
    const credits = document.getElementById('credits');
    const more = document.getElementById('more');
    
    // Add pop-in class to main elements
    if (contentBox) {
        contentBox.classList.add('pop-in');
    }
    
    if (credits) {
        setTimeout(() => {
            credits.classList.add('pop-in');
        }, 100);
    }
    
    if (more) {
        setTimeout(() => {
            more.classList.add('pop-in');
        }, 200);
    }
    
    // Add fade-in to role tags with stagger (like your explore page result items)
    const roleTags = document.querySelectorAll('.role-tag, .type-tag');
    roleTags.forEach((tag, index) => {
        setTimeout(() => {
            tag.classList.add('pop-in');
            tag.addEventListener('animationend', () => {
                tag.classList.remove('pop-in');
            }, {once: true});
        }, 300 + (index * 100));
    });
}

function setupHoverEffects() {
    // Credits list item animation
    const creditItems = document.querySelectorAll('#credits li');
    creditItems.forEach((item, index) => {
        item.addEventListener('mouseenter', () => {
            // Animate other items to fade slightly
            creditItems.forEach((otherItem, otherIndex) => {
                if (otherIndex !== index) {
                    otherItem.style.opacity = '0.6';
                    otherItem.style.transform = 'translateX(0)';
                }
            });
        });
        
        item.addEventListener('mouseleave', () => {
            // Reset all items
            creditItems.forEach(otherItem => {
                otherItem.style.opacity = '';
                otherItem.style.transform = '';
            });
        });
    });
    
    // Role tags enhanced hover with ripple
    const roleTags = document.querySelectorAll('.role-tag, .type-tag');
    roleTags.forEach(tag => {
        tag.addEventListener('mouseenter', () => {
            createRipple(tag);
        });
    });
}

function setupSmoothScroll() {
    // Smooth scroll for any anchor links within the page
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function setupScrollAnimations() {
    // Use your exact explore page scroll animation pattern
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                // Clean up fade-in class after animation
                entry.target.addEventListener('animationend', () => {
                    entry.target.classList.remove('fade-in');
                }, {once: true});
            }
        });
    }, observerOptions);
    
    // Observe elements for scroll animations
    const elementsToObserve = document.querySelectorAll('#more, #credits');
    elementsToObserve.forEach(el => observer.observe(el));
}

// Mouse cursor integration (if mouse-follower is available)
if (typeof cursor !== 'undefined') {
    const interactiveElements = document.querySelectorAll('.role-tag, .type-tag, #attachments');
    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            cursor.addState('-pointer');
        });
        
        element.addEventListener('mouseleave', () => {
            cursor.removeState('-pointer');
        });
    });
}

// Keyboard navigation enhancement
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        const focusedElement = document.activeElement;
        if (focusedElement.classList.contains('role-tag') || focusedElement.classList.contains('type-tag')) {
            focusedElement.style.transform = 'translateY(-2px) scale(1.05)';
            setTimeout(() => {
                if (document.activeElement !== focusedElement) {
                    focusedElement.style.transform = '';
                }
            }, 200);
        }
    }
});

// Add focus out handler
document.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('role-tag') || e.target.classList.contains('type-tag')) {
        e.target.style.transform = '';
    }
});

function setupVersionHistory() {
    const versionToggle = document.querySelector('.version-toggle');
    const versionList = document.querySelector('.version-list');
    
    if (versionToggle && versionList) {
        versionToggle.addEventListener('click', () => {
            const isExpanded = versionToggle.getAttribute('aria-expanded') === 'true';
            
            // Toggle aria-expanded
            versionToggle.setAttribute('aria-expanded', !isExpanded);
            
            // Toggle aria-hidden on version list
            versionList.setAttribute('aria-hidden', isExpanded);
            
            // Update max-height for smooth animation
            if (!isExpanded) {
                versionList.style.maxHeight = versionList.scrollHeight + 'px';
            } else {
                versionList.style.maxHeight = '0';
            }
        });
    }
}

function processDescriptionTimestamps() {
    // This function ensures timestamp processing happens even if video-viewer.js
    // isn't loaded for some reason (fallback functionality)
    const descriptionElement = document.querySelector('#description p');
    if (!descriptionElement) return;
    
    // Check if timestamps have already been processed (avoid double processing)
    if (descriptionElement.querySelector('.timestamp-link')) return;
    
    const text = descriptionElement.innerHTML;
    const timestampRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
    
    const processedText = text.replace(timestampRegex, (match, timestamp) => {
        return `<span class="timestamp-text" data-timestamp="${timestamp}" title="Timestamp: ${timestamp}">${timestamp}</span>`;
    });
    
    if (processedText !== text) {
        descriptionElement.innerHTML = processedText;
    }
}

// Ripple effect utility function
function createRipple(element) {
    // Don't add ripple if reduced motion is preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(0);
        border-radius: 50%;
        background: rgba(115, 103, 240, 0.3);
        pointer-events: none;
        animation: projectRipple 0.6s ease-out;
        z-index: 1;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
        if (ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
        }
    }, 600);
}

// Add custom CSS for timestamps and ripple effect
const projectStyles = document.createElement('style');
projectStyles.textContent = `
    @keyframes projectRipple {
        from {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
        }
        to {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
        }
    }
    
    .timestamp-text {
        color: hsla(242, 61%, 67%, 1);
        font-weight: 600;
        text-decoration: underline;
        text-decoration-style: dotted;
        cursor: help;
    }
    
    .timestamp-text:hover {
        color: hsla(242, 61%, 80%, 1);
    }
`;
document.head.appendChild(projectStyles);