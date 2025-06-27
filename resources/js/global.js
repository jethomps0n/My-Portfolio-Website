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

//-------CURSOR-------------//
const cursor = new MouseFollower({
    el: null,
    container: document.body,
    className: 'mf-cursor',
    innerClassName: 'mf-cursor-inner',
    textClassName: 'mf-cursor-text',
    mediaClassName: 'mf-cursor-media',
    mediaBoxClassName: 'mf-cursor-media-box',
    iconSvgClassName: 'mf-svgsprite',
    iconSvgNamePrefix: '-',
    iconSvgSrc: '',
    dataAttr: 'cursor',
    hiddenState: '-hidden',
    textState: '-text',
    iconState: '-icon',
    activeState: '-active',
    mediaState: '-media',
    stateDetection: {
        '-pointer': 'a,button',
        '-hidden': 'iframe'
    },
    visible: true,
    visibleOnState: false,
    speed: 0.55,
    ease: 'expo.out',
    overwrite: true,
    skewing: 0,
    skewingText: 2,
    skewingIcon: 2,
    skewingMedia: 2,
    skewingDelta: 0.001,
    skewingDeltaMax: 0.15,
    stickDelta: 0.15,
    showTimeout: 20,
    hideOnLeave: true,
    hideTimeout: 300,
    hideMediaTimeout: 300
});

//-------GLOBAL ANIMATIONS-------------//
document.addEventListener('DOMContentLoaded', () => {
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
    
    // Add ripple animation style if not already present
    if (!document.querySelector('[data-global-ripple-style]')) {
        const style = document.createElement('style');
        style.setAttribute('data-global-ripple-style', 'true');
        style.textContent = `
            @keyframes globalRipple {
                from {
                    transform: translate(-50%, -50%) scale(0);
                    opacity: 0.6;
                }
                to {
                    transform: translate(-50%, -50%) scale(2);
                    opacity: 0;
                }
            }
            .ripple-container {
                position: relative;
                overflow: hidden;
            }
        `;
        document.head.appendChild(style);
    }
    
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

// Add global fade-in animation
if (!document.querySelector('[data-global-fade-style]')) {
    const style = document.createElement('style');
    style.setAttribute('data-global-fade-style', 'true');
    style.textContent = `
        .fade-in {
            animation: globalFadeIn 0.4s ease-out;
        }
        
        @keyframes globalFadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}