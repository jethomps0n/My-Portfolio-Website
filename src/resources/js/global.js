//-------NOISE-------------//
const noise = id => {
    let canvas, ctx;
    let wWidth, wHeight;
    let noiseData = [];
    let frame = 0;
    let loopTimeout;

    // Create Noise
    const createNoise = () => {
        const idata = ctx.createImageData(wWidth, wHeight);
        const buffer32 = new Uint32Array(idata.data.buffer);
        const len = buffer32.length;

        for (let i = 0; i < len; i++) {
            if (Math.random() < 0.5) {
                buffer32[i] = 0xff000000;
            }
        }

        noiseData.push(idata);
    };

    // Play Noise
    const paintNoise = () => {
        if (frame === 9) {
            frame = 0;
        } else {
            frame++;
        }

        ctx.putImageData(noiseData[frame], 0, 0);
    };

    // Loop
    const loop = () => {
        paintNoise(frame);

        loopTimeout = window.setTimeout(() => {
            window.requestAnimationFrame(loop);
        }, (1000 / 25));
    };

    // Setup
    const setup = () => {
        wWidth = window.innerWidth;
        wHeight = window.innerHeight;

        canvas.width = wWidth;
        canvas.height = wHeight;

        for (let i = 0; i < 10; i++) {
            createNoise();
        }

        loop();
    };

    // Reset
    let resizeThrottle;
    const reset = () => {
        window.addEventListener('resize', () => {
            window.clearTimeout(resizeThrottle);

            resizeThrottle = window.setTimeout(() => {
                window.clearTimeout(loopTimeout);
                setup();
            }, 200);
        }, false);
    };

    // Init
    const init = (() => {
        canvas = document.getElementById(id);
        ctx = canvas.getContext('2d');

        setup();
    })();
};

noise('noise');
noise('softnoise');

//-------REFINED ELASTIC CURSOR-------------//
let cursor = null;

// Ensure scroll to top happens as early as possible
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Early scroll to top - happens before DOM is ready
window.addEventListener('beforeunload', () => {
    window.scrollTo(0, 0);
});

// Immediate scroll reset
window.scrollTo(0, 0);

document.addEventListener('DOMContentLoaded', () => {
    createRefinedCursor();
});

function createRefinedCursor() {
    // Don't create cursor on mobile devices
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
        return;
    }

    // Create cursor element
    const cursorEl = document.createElement('div');
    cursorEl.className = 'refined-cursor';
    document.body.appendChild(cursorEl);

    // Cursor position tracking
    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;

    // Get current cursor size for proper centering
    function getCurrentCursorSize() {
        const rect = cursorEl.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    // Smooth cursor movement with elastic effect
    function animateCursor() {
        const ease = 0.12;
        cursorX += (mouseX - cursorX) * ease;
        cursorY += (mouseY - cursorY) * ease;

        // Get current size and center the cursor on the cursor tip
        const size = getCurrentCursorSize();
        const offsetX = size.width / 2;
        const offsetY = size.height / 2;

        // Center the custom cursor on the real cursor tip
        cursorEl.style.transform = `translate(${cursorX - offsetX}px, ${cursorY - offsetY}px)`;

        requestAnimationFrame(animateCursor);
    }

    // Mouse move handler with youtube-lite detection
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Check if we're hovering over a lite-youtube element
        const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
        const isOverYoutubeLite = elementUnderCursor && (
            elementUnderCursor.tagName === 'LITE-YOUTUBE' ||
            elementUnderCursor.closest('lite-youtube')
        );

        if (isOverYoutubeLite) {
            cursorEl.classList.add('hidden');
        } else {
            // Show cursor if hidden and not over youtube-lite
            if (cursorEl.classList.contains('hidden')) {
                cursorEl.classList.remove('hidden');
            }
        }
    });

    // Mouse leave/enter handlers
    document.addEventListener('mouseleave', () => {
        cursorEl.classList.add('hidden');
    });

    document.addEventListener('mouseenter', () => {
        cursorEl.classList.remove('hidden');
    });

    // Enhanced but simplified interaction handlers
    setupRefinedInteractions(cursorEl);

    // Start animation loop
    animateCursor();
}

function setupRefinedInteractions(cursorEl) {
    let currentHoverTarget = null;

    // Helper function to determine appropriate hover size based on element
    function getHoverClass(element) {
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        
        // Special cases for specific elements
        if (element.matches('.role-tag, .type-tag')) {
            return 'hover-small role-hover';
        }
        
        // Transparent cursor for better text legibility on these elements
        if (element.matches(`
            .filter-group .toggle,
            #clear-filters,
            #pagination button,
            .show-more,
            .sort-wrapper,
            #sort-select,
            #clear-search,
            .active-filter button,
            #set-custom
        `)) {
            return 'transparent';
        }
        
        // Small clickable elements (buttons, small links, nav items)
        if (element.matches('button, .nav, input[type="submit"], input[type="button"]') ||
            (element.tagName === 'A' && area < 5000)) {
            return 'hover-small';
        }
        
        // Medium elements (larger links, medium containers)
        if ((element.tagName === 'A' && area < 15000) ||
            element.matches('.button, [data-cursor="pointer"]')) {
            return 'hover-medium';
        }
        
        // Large clickable areas
        if (area >= 15000) {
            return 'hover-large';
        }
        
        // Default medium size
        return 'hover-medium';
    }

    // Helper function to find the closest interactive element
    function findInteractiveElement(element) {
        let current = element;
        while (current && current !== document.body) {
            if (current.matches('a, button, .nav, .button, [data-cursor="pointer"], .role-tag, .type-tag, .filter-group .toggle')) {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    // Global mouseover handler with simplified logic
    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        
        // Check for lite-youtube first - always hide cursor
        if (target.matches('lite-youtube') || target.closest('lite-youtube')) {
            cursorEl.className = 'refined-cursor hidden';
            cursorEl.style.background = '';
            currentHoverTarget = null;
            return;
        }
        
        // Text inputs get text cursor
        if (target.matches('input[type="text"], input[type="search"], textarea, [contenteditable]')) {
            cursorEl.className = 'refined-cursor text';
            cursorEl.style.background = '';
            currentHoverTarget = target;
            return;
        }
        
        // Hide on non-text form inputs
        if (target.matches('input:not([type="text"]):not([type="search"]), select')) {
            cursorEl.className = 'refined-cursor hidden';
            cursorEl.style.background = '';
            currentHoverTarget = target;
            return;
        }
        
        // Media elements
        if (target.matches('video, img, .thumbnail, .frame, canvas')) {
            cursorEl.className = 'refined-cursor media';
            cursorEl.style.background = '';
            currentHoverTarget = target;
            return;
        }
        
        // Find interactive element (either target or parent)
        const interactiveElement = findInteractiveElement(target);
        
        if (interactiveElement) {
            // Only change state if we're hovering a different element
            if (currentHoverTarget !== interactiveElement) {
                const hoverClass = getHoverClass(interactiveElement);
                cursorEl.className = `refined-cursor ${hoverClass}`;
                cursorEl.style.background = '';
                currentHoverTarget = interactiveElement;
            }
            return;
        }
        
        // Special case for content containers - only change color, not size
        if (target.matches('.contentContainer')) {
            // Only apply if not already applied
            if (currentHoverTarget !== target) {
                cursorEl.className = 'refined-cursor';
                cursorEl.style.background = 'hsla(214, 100%, 45%, 0.5)';
                currentHoverTarget = target;
            }
            return;
        }
        
        // Reset to default state for non-interactive elements
        if (currentHoverTarget !== null) {
            cursorEl.className = 'refined-cursor';
            cursorEl.style.background = '';
            currentHoverTarget = null;
        }
    });

    // Global mouseout handler
    document.addEventListener('mouseout', (e) => {
        const target = e.target;
        const relatedTarget = e.relatedTarget;
        
        // Don't reset if moving to a child element
        if (relatedTarget && target.contains(relatedTarget)) {
            return;
        }
        
        // Don't reset if moving within the same interactive element
        if (currentHoverTarget && relatedTarget) {
            const currentInteractive = findInteractiveElement(currentHoverTarget);
            const relatedInteractive = findInteractiveElement(relatedTarget);
            if (currentInteractive && currentInteractive === relatedInteractive) {
                return;
            }
        }
        
        // Special handling for lite-youtube
        if (target.matches('lite-youtube') || target.closest('lite-youtube')) {
            // Check if we're still over a lite-youtube element
            setTimeout(() => {
                const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
                if (!elementUnderCursor || 
                    (!elementUnderCursor.closest('lite-youtube') && elementUnderCursor.tagName !== 'LITE-YOUTUBE')) {
                    cursorEl.classList.remove('hidden');
                    currentHoverTarget = null;
                }
            }, 10);
            return;
        }
        
        // Reset cursor when leaving interactive elements
        if (target === currentHoverTarget || 
            (currentHoverTarget && target.contains(currentHoverTarget))) {
            cursorEl.className = 'refined-cursor';
            cursorEl.style.background = '';
            currentHoverTarget = null;
        }
    });

    // Mouse down/up for active state
    document.addEventListener('mousedown', (e) => {
        const target = e.target;
        if (!target.closest('lite-youtube') && target.tagName !== 'LITE-YOUTUBE') {
            cursorEl.classList.add('active');
        }
    });

    document.addEventListener('mouseup', () => {
        cursorEl.classList.remove('active');
    });

    // Special navbar logo interaction
    const webTitle = document.getElementById('webTitle');
    if (webTitle) {
        webTitle.addEventListener('mouseenter', () => {
            if (currentHoverTarget === webTitle) {
                cursorEl.style.background = 'hsla(242, 61%, 80%, 0.9)';
            }
        });
        
        webTitle.addEventListener('mouseleave', () => {
            if (currentHoverTarget === webTitle) {
                cursorEl.style.background = '';
            }
        });
    }
}

//-------GLOBAL ANIMATIONS-------------//
document.addEventListener('DOMContentLoaded', () => {
    // Always scroll to top on page load/refresh - ensure this happens immediately
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    // Force scroll to top immediately and reliably
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    
    // Check if this is a fresh page load (not navigation)
    const isPageReload = performance.getEntriesByType('navigation')[0].type === 'reload' || 
                        !document.referrer || 
                        !document.referrer.includes(window.location.hostname);
    
    // Only animate navbar on fresh page loads
    if (isPageReload) {
        const header = document.querySelector('header');
        if (header) {
            // Add the initial hidden state
            header.classList.add('navbar-animate');
            
            setTimeout(() => {
                header.classList.add('animate-slide-down');
                header.classList.remove('navbar-animate');
                
                // Clean up animation class after it completes
                header.addEventListener('animationend', () => {
                    header.classList.remove('animate-slide-down');
                }, { once: true });
            }, 100);
        }
    }

    // Footer animation (only on first scroll into view)
    setupFooterAnimation();

    // Global ripple effect for buttons
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('button, .button, .nav')) {
            createGlobalRipple(target, e);
        }
    });
});

function setupFooterAnimation() {
    const footer = document.getElementById('footer');
    const footerTop = document.getElementById('footer-top');
    const footerMiddle = document.getElementById('footer-middle');
    
    // Flag to track if footer has been animated
    let footerAnimated = sessionStorage.getItem('footerAnimated') === 'true';
    
    if (footer && !footerAnimated) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !footerAnimated) {
                    // Mark as animated for this session
                    footerAnimated = true;
                    sessionStorage.setItem('footerAnimated', 'true');
                    
                    // Add animation classes
                    footer.classList.add('footer-first-view');
                    if (footerTop) footerTop.classList.add('footer-first-view');
                    if (footerMiddle) footerMiddle.classList.add('footer-first-view');
                    
                    // Clean up animation classes after completion
                    footer.addEventListener('animationend', () => {
                        footer.classList.remove('footer-first-view');
                    }, { once: true });
                    
                    if (footerTop) {
                        footerTop.addEventListener('animationend', () => {
                            footerTop.classList.remove('footer-first-view');
                        }, { once: true });
                    }
                    
                    if (footerMiddle) {
                        footerMiddle.addEventListener('animationend', () => {
                            footerMiddle.classList.remove('footer-first-view');
                        }, { once: true });
                    }
                    
                    // Stop observing once animated
                    observer.disconnect();
                }
            });
        }, observerOptions);
        
        observer.observe(footer);
    }
}

function createGlobalRipple(element, event) {
    // Don't add ripple if reduced motion is preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    // Get click position relative to element
    const x = event ? event.clientX - rect.left : rect.width / 2;
    const y = event ? event.clientY - rect.top : rect.height / 2;
    
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        transform: translate(-50%, -50%) scale(0);
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        pointer-events: none;
        animation: globalRipple 0.6s ease-out;
        z-index: 1;
    `;
    
    element.classList.add('ripple-container');
    element.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
        if (ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
        }
    }, 600);
}

//-------FOOTER OTHER ROLE LINK-------------//
document.addEventListener('DOMContentLoaded', () => {
  const otherLink = document.getElementById('other-link');
  if (!otherLink) return;
  fetch('/resources/json/data.json')
    .then(r => r.json())
    .then(data => {
      const mainRoles = ['Writer','Editor','Director','Producer','DP','Camera Operator','Production Assistant','Sound Recordist'];
      const others = new Set();
      data.forEach(item => {
        const roles = (item.role || '').split('/').map(r => r.trim()).filter(Boolean);
        roles.forEach(role => {
          if (!mainRoles.includes(role)) others.add(role);
        });
      });
      const query = Array.from(others).map(r => encodeURIComponent(r)).join(',');
      otherLink.href = query ? `/explore/?roles=${query}` : '/explore';
    })
    .catch(err => {
      console.error('Failed to compute other roles', err);
      otherLink.href = '/explore';
    });
});

//-------SCROLL ANIMATIONS-------------//
// Create a global intersection observer for scroll animations
const createScrollObserver = () => {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    return new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                entry.target.addEventListener('animationend', () => {
                    entry.target.classList.remove('fade-in');
                }, { once: true });
            }
        });
    }, observerOptions);
};

// Export for use in other scripts
window.globalScrollObserver = createScrollObserver();