// Video viewer - Light and functional Plyr initialization
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Plyr to be available
    if (typeof Plyr === 'undefined') {
        console.warn('Plyr not loaded yet, retrying...');
        setTimeout(initializePlayer, 100);
        return;
    }
    
    initializePlayer();
});

function initializePlayer() {
    const player = document.querySelector('#player');
    
    if (!player) {
        console.warn('No player element found');
        return;
    }

    // Check if it's an embed (YouTube/Vimeo) or regular video
    const isEmbed = player.classList.contains('plyr__video-embed') || player.querySelector('iframe');
    
    try {
        // Enhanced configuration for better compatibility
        const config = {
            // Basic controls - keep it simple
            controls: [
                'play-large',
                'play',
                'progress', 
                'current-time',
                'duration',
                'mute',
                'volume',
                'settings',
                'fullscreen'
            ],
            
            // Settings menu
            settings: ['quality', 'speed'],
            
            // Quality options for video
            quality: {
                default: 720,
                options: [1080, 720, 480, 360]
            },
            
            // Speed controls
            speed: {
                selected: 1,
                options: [0.5, 0.75, 1, 1.25, 1.5, 2]
            },
            
            // Disable problematic features that caused bugs
            keyboard: { focused: true, global: false },
            tooltips: { controls: true, seek: true },
            captions: { active: false },
            
            // Simple, stable settings
            ratio: null, // Let aspect ratio be natural
            fullscreen: { enabled: true, fallback: true },
            storage: { enabled: false }, // Disable storage to prevent conflicts
            
            // Disable automatic quality switching to prevent bugs
            autopause: false,
            resetOnEnd: false,
            
            // Enhanced embed handling
            youtube: {
                noCookie: true,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                modestbranding: 1
            },
            
            vimeo: {
                byline: false,
                portrait: false,
                title: false,
                speed: true,
                transparent: false
            }
        };
        
        // Initialize Plyr with enhanced configuration
        const plyr = new Plyr(player, config);

        // Enhanced event listeners for better functionality
        plyr.on('ready', () => {
            console.log('Plyr ready');
            
            // Apply consistent styling after initialization
            applyCustomStyling(plyr);
            
            // Handle embed-specific fixes
            if (isEmbed) {
                handleEmbedFixes(plyr);
            }
        });

        plyr.on('error', (event) => {
            console.warn('Plyr error:', event.detail);
        });
        
        // Handle loading states
        plyr.on('loadstart', () => {
            console.log('Video loading started');
        });
        
        plyr.on('canplay', () => {
            console.log('Video can start playing');
            // Reapply styling after video loads
            applyCustomStyling(plyr);
        });

        // Store player reference for potential cleanup
        window.plyrInstance = plyr;

    } catch (error) {
        console.error('Failed to initialize Plyr:', error);
        // Fallback: ensure native controls are enabled
        player.setAttribute('controls', 'controls');
    }
}

// Apply custom styling to ensure consistency across all video types
function applyCustomStyling(plyr) {
    if (!plyr || !plyr.elements) return;
    
    try {
        // Ensure the main container has proper styling
        const container = plyr.elements.container;
        if (container) {
            container.style.borderRadius = '20px';
            container.style.overflow = 'hidden';
            container.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.35)';
        }
        
        // Style the wrapper if it exists
        const wrapper = plyr.elements.wrapper;
        if (wrapper) {
            wrapper.style.borderRadius = '20px';
            wrapper.style.overflow = 'hidden';
        }
        
        // Handle iframe styling for embeds
        const iframe = container?.querySelector('iframe');
        if (iframe) {
            iframe.style.borderRadius = '20px';
        }
        
    } catch (error) {
        console.warn('Error applying custom styling:', error);
    }
}

// Handle embed-specific fixes for YouTube/Vimeo
function handleEmbedFixes(plyr) {
    if (!plyr || !plyr.elements) return;
    
    try {
        const container = plyr.elements.container;
        const iframe = container?.querySelector('iframe');
        
        if (iframe && iframe.src) {
            // YouTube-specific fixes
            if (iframe.src.includes('youtube.com') || iframe.src.includes('youtu.be')) {
                console.log('Applying YouTube embed fixes');
                iframe.style.transform = 'scale(1.05)';
                iframe.style.margin = '-2.5%';
                
                // Additional YouTube URL parameters to hide UI elements
                const currentSrc = iframe.src;
                const separator = currentSrc.includes('?') ? '&' : '?';
                const additionalParams = 'rel=0&showinfo=0&iv_load_policy=3&modestbranding=1&controls=1';
                
                if (!currentSrc.includes('rel=0')) {
                    iframe.src = currentSrc + separator + additionalParams;
                }
            }
            
            // Vimeo-specific fixes
            if (iframe.src.includes('vimeo.com')) {
                console.log('Applying Vimeo embed fixes');
                iframe.style.transform = 'scale(1.01)';
                iframe.style.margin = '-0.5%';
                
                // Ensure proper aspect ratio for Vimeo
                const embedContainer = iframe.closest('.plyr__video-embed');
                if (embedContainer) {
                    embedContainer.style.paddingBottom = '56.25%';
                    embedContainer.style.height = '0';
                    embedContainer.style.position = 'relative';
                    
                    iframe.style.position = 'absolute';
                    iframe.style.top = '0';
                    iframe.style.left = '0';
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                }
            }
        }
        
    } catch (error) {
        console.warn('Error applying embed fixes:', error);
    }
}

// Additional initialization for edge cases
function ensureVideoStyling() {
    // Apply styling to any video elements that might not have been caught
    const allVideos = document.querySelectorAll('video, iframe, .plyr__video-embed');
    
    allVideos.forEach(element => {
        if (element.tagName === 'VIDEO' || element.tagName === 'IFRAME') {
            element.style.borderRadius = '20px';
        }
        
        if (element.classList.contains('plyr__video-embed')) {
            element.style.borderRadius = '20px';
            element.style.overflow = 'hidden';
            element.style.background = '#000';
        }
    });
}

// Run additional styling after a delay to catch late-loading elements
setTimeout(ensureVideoStyling, 1000);

// Also run when the window loads completely
window.addEventListener('load', ensureVideoStyling);

// Enhanced cleanup function for page navigation
function cleanupPlayer() {
    if (window.plyrInstance) {
        try {
            window.plyrInstance.destroy();
            window.plyrInstance = null;
            console.log('Plyr instance cleaned up');
        } catch (error) {
            console.warn('Error cleaning up Plyr:', error);
        }
    }
    
    // Clean up any remaining event listeners
    const videos = document.querySelectorAll('video, iframe');
    videos.forEach(video => {
        video.removeEventListener('loadstart', () => {});
        video.removeEventListener('canplay', () => {});
    });
}

// Clean up on page unload
window.addEventListener('beforeunload', cleanupPlayer);