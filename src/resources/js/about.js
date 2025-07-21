// About Page JavaScript - Following the design philosophy with INP optimizations

document.addEventListener('DOMContentLoaded', () => {
    // Initialize page elements with proper prioritization
    scheduler.postTask(() => {
        initializeAboutPage();
    }, { priority: 'user-blocking' });
    
    // Setup scroll animations with lower priority
    scheduler.postTask(() => {
        setupScrollAnimations();
    }, { priority: 'user-visible' });
    
    // Add interactive enhancements with background priority
    scheduler.postTask(() => {
        addInteractiveEffects();
    }, { priority: 'background' });
    
    // Setup availability toggle
    scheduler.postTask(() => {
        setupAvailabilityToggle();
    }, { priority: 'user-visible' });
    
    // Setup profile image cycling
    scheduler.postTask(() => {
        setupProfileImageCycling();
    }, { priority: 'user-visible' });
});

function initializeAboutPage() {
    // Force scroll to top - optimize with single batch operation
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    // Batch scroll operations
    requestAnimationFrame(() => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
    });
    
    // Check if this is a fresh page load for animations
    const isPageReload = performance.getEntriesByType('navigation')[0].type === 'reload' || 
                        !document.referrer || 
                        !document.referrer.includes(window.location.hostname);
    
    // Add staggered animations to elements with yielding
    if (isPageReload) {
        scheduler.postTask(() => {
            staggerAnimations();
        }, { priority: 'user-visible' });
    }
}

async function staggerAnimations() {
    const elements = document.querySelectorAll('.pop-in');
    
    // Process elements in batches for better performance
    const BATCH_SIZE = 3;
    for (let i = 0; i < elements.length; i += BATCH_SIZE) {
        const batch = elements.slice(i, i + BATCH_SIZE);
        
        await scheduler.postTask(() => {
            batch.forEach((element, batchIndex) => {
                const index = i + batchIndex;
                // Add visible class with staggered delay
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        element.classList.add('visible');
                    });
                }, index * 200);
            });
        }, { priority: 'user-visible' });
    }
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

// Availability Toggle Functionality
function setupAvailabilityToggle() {
    const availabilityCard = document.getElementById('availability-card');
    const availabilityTitle = document.getElementById('availability-title');
    const availabilityMeta = document.getElementById('availability-meta');
    const availabilityText = document.getElementById('availability-text');
    
    if (availabilityCard && availabilityTitle && availabilityMeta && availabilityText) {
        // Check if card has 'unavailable' class and update content accordingly
        updateAvailabilityContent();
    }
    
    function updateAvailabilityContent() {
        const isUnavailable = availabilityCard.classList.contains('unavailable');
        
        if (isUnavailable) {
            availabilityTitle.textContent = 'Currently Unavailable';
            availabilityMeta.textContent = 'Focused on Current Projects';
            availabilityText.innerHTML = 'I\'m currently focused on existing commitments and projects. However, I\'m always interested in discussing future opportunities. Feel free to <a href="/contact/" style="color: hsla(242, 61%, 80%, 1);">reach out</a> and I\'ll get back to you when my schedule opens up.';
        }
    }
}

// Profile Image Cycling Functionality
function setupProfileImageCycling() {
    // Check if we're in split frame mode
    const isSplitFrameMode = window.innerWidth <= 768 && window.innerWidth >= 521;
    
    if (isSplitFrameMode) {
        setupSplitFrameCycling();
    } else {
        setupSingleFrameCycling();
    }
    
    // Listen for resize events to switch between modes
    window.addEventListener('resize', () => {
        const newIsSplitFrameMode = window.innerWidth <= 768 && window.innerWidth >= 521;
        if (newIsSplitFrameMode !== isSplitFrameMode) {
            // Clear existing intervals and restart
            clearAllIntervals();
            if (newIsSplitFrameMode) {
                setupSplitFrameCycling();
            } else {
                setupSingleFrameCycling();
            }
        }
    });
}

let frameIntervals = [];

function clearAllIntervals() {
    frameIntervals.forEach(interval => clearInterval(interval));
    frameIntervals = [];
}

function setupSplitFrameCycling() {
    const frame1Images = document.querySelectorAll('#profile-frame-1 .profile-image');
    const frame2Images = document.querySelectorAll('#profile-frame-2 .profile-image');
    
    if (frame1Images.length === 0 || frame2Images.length === 0) return;
    
    let frame1Index = 0;
    let frame2Index = 0;
    const cycleInterval = 9500; // 9.5 seconds between images
    
    function cycleFrame1() {
        frame1Images[frame1Index].classList.remove('active');
        frame1Index = (frame1Index + 1) % frame1Images.length;
        frame1Images[frame1Index].classList.add('active');
    }
    
    function cycleFrame2() {
        frame2Images[frame2Index].classList.remove('active');
        frame2Index = (frame2Index + 1) % frame2Images.length;
        frame2Images[frame2Index].classList.add('active');
    }
    
    // Start cycling for both frames with slight offset
    const interval1 = setInterval(cycleFrame1, cycleInterval);
    const interval2 = setInterval(cycleFrame2, cycleInterval);
    
    frameIntervals.push(interval1, interval2);
    
    // Optional: Add click handlers for manual cycling
    document.getElementById('profile-frame-1')?.addEventListener('click', cycleFrame1);
    document.getElementById('profile-frame-2')?.addEventListener('click', cycleFrame2);
}

function setupSingleFrameCycling() {
    const images = document.querySelectorAll('.single-frame .profile-image');
    const profileFrame = document.getElementById('profile-frame');
    
    if (images.length === 0) return;
    
    let currentImageIndex = 0;
    const cycleInterval = 9500; // 9.5 seconds between images
    let isPaused = false;
    
    function cycleToNextImage() {
        if (isPaused) return;
        
        // Remove active class from current image
        images[currentImageIndex].classList.remove('active');
        
        // Move to next image (loop back to 0 if at end)
        currentImageIndex = (currentImageIndex + 1) % images.length;
        
        // Add active class to new current image
        images[currentImageIndex].classList.add('active');
    }
    
    function startCycling() {
        clearAllIntervals();
        const intervalId = setInterval(cycleToNextImage, cycleInterval);
        frameIntervals.push(intervalId);
    }
    
    function stopCycling() {
        clearAllIntervals();
    }
    
    // Start the cycling
    startCycling();
    
    // Pause cycling on hover (optional)
    if (profileFrame) {
        profileFrame.addEventListener('mouseenter', () => {
            isPaused = true;
            stopCycling();
        });
        
        profileFrame.addEventListener('mouseleave', () => {
            isPaused = false;
            startCycling();
        });
        
        // Optional: Allow manual cycling on click
        profileFrame.addEventListener('click', () => {
            cycleToNextImage();
            // Restart the interval to maintain consistent timing
            startCycling();
        });
    }
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

// Initial setup calls
document.addEventListener('DOMContentLoaded', () => {
    setupAvailabilityToggle();
});