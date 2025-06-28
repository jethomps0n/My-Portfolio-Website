// About Page JavaScript - Following the design philosophy

document.addEventListener('DOMContentLoaded', () => {
    // Initialize page elements
    initializeAboutPage();
    
    // Setup scroll animations
    setupScrollAnimations();
    
    // Add interactive enhancements
    addInteractiveEffects();
});

function initializeAboutPage() {
    // Force scroll to top
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    
    // Check if this is a fresh page load for animations
    const isPageReload = performance.getEntriesByType('navigation')[0].type === 'reload' || 
                        !document.referrer || 
                        !document.referrer.includes(window.location.hostname);
    
    // Add staggered animations to elements
    if (isPageReload) {
        staggerAnimations();
    }
}

function staggerAnimations() {
    const elements = document.querySelectorAll('.pop-in');
    
    elements.forEach((element, index) => {
        // Remove the pop-in class initially
        element.classList.remove('pop-in');
        
        // Add it back with a delay
        setTimeout(() => {
            element.classList.add('pop-in');
        }, index * 200);
    });
}

function setupScrollAnimations() {
    // Create intersection observer for scroll-triggered animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements that should animate on scroll
    const scrollElements = document.querySelectorAll('.section-content, .skill-item');
    scrollElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

function addInteractiveEffects() {
    // Add ripple effect to CTA buttons
    const ctaButtons = document.querySelectorAll('.cta-button');
    ctaButtons.forEach(button => {
        button.addEventListener('click', createRippleEffect);
    });
    
    // Add subtle parallax effect to hero section
    setupParallaxEffect();
    
    // Enhanced hover effects for skill items
    setupSkillItemEffects();
}

function createRippleEffect(e) {
    // Don't add ripple if reduced motion is preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const button = e.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    // Get click position relative to button
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
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
        animation: aboutRipple 0.6s ease-out;
        z-index: 1;
    `;
    
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
        if (ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
        }
    }, 600);
}

function setupParallaxEffect() {
    const hero = document.getElementById('about-hero');
    if (!hero) return;
    
    // Only add parallax if user doesn't prefer reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.2;
        
        hero.style.transform = `translateY(${rate}px)`;
    });
}

function setupSkillItemEffects() {
    const skillItems = document.querySelectorAll('.skill-item');
    
    skillItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            // Add subtle glow effect
            item.style.boxShadow = '0 8px 32px rgba(115, 103, 240, 0.15)';
        });
        
        item.addEventListener('mouseleave', () => {
            // Remove glow effect
            item.style.boxShadow = '';
        });
    });
}

// Add custom animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes aboutRipple {
        from {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
        }
        to {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Enhanced text effects
document.addEventListener('DOMContentLoaded', () => {
    // Add typing effect to subtitle (optional enhancement)
    const subtitle = document.querySelector('.about-subtitle');
    if (subtitle && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const text = subtitle.textContent;
        subtitle.textContent = '';
        
        let i = 0;
        const typeWriter = () => {
            if (i < text.length) {
                subtitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            }
        };
        
        // Start typing effect after a short delay
        setTimeout(typeWriter, 800);
    }
});