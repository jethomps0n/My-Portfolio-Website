document.addEventListener('DOMContentLoaded', () => {
    // Use your exact explore page animation cleanup pattern
    document.querySelectorAll('.pop-in').forEach(el => {
        el.addEventListener('animationend', () => el.classList.remove('pop-in'), {once: true});
    });
    
    // Apply animations using your exact pattern
    animatePageElements();
    
    // Setup other functionality
    setupHoverEffects();
    setupSmoothScroll();
    setupScrollAnimations();
});

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

function createRipple(element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = '50%';
    ripple.style.top = '50%';
    ripple.style.transform = 'translate(-50%, -50%) scale(0)';
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'rgba(255, 255, 255, 0.3)';
    ripple.style.pointerEvents = 'none';
    ripple.style.animation = 'ripple 0.6s ease-out';
    
    // Add ripple animation if not already present
    if (!document.querySelector('[data-ripple-style]')) {
        const style = document.createElement('style');
        style.setAttribute('data-ripple-style', 'true');
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
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