// Video Viewer JavaScript - Timestamp Functionality for Project Pages

let player = null;
let playerType = null; // 'video', 'youtube', 'iframe'

// Timestamp parsing utility
function parseTimestamp(timeStr) {
    const parts = timeStr.trim().split(':').map(Number);
    
    if (parts.length === 2) {
        // MM:SS format
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        // HH:MM:SS format
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    return 0;
}

// Seek to timestamp function
function seekToTimestamp(seconds) {
    const videoElement = document.querySelector('#player video');
    const iframe = document.querySelector('#player iframe');
    
    if (!videoElement && !iframe) {
        console.warn('No video player found for timestamp seeking');
        return;
    }
    
    try {
        if (videoElement) {
            // Direct video element - use native currentTime and play
            videoElement.currentTime = seconds;
            videoElement.play();
            console.log(`Seeking to ${seconds} seconds and playing native video element`);
        } else if (iframe) {
            // Handle iframe embeds
            updateIframeTimestamp(iframe, seconds);
        }
    } catch (error) {
        console.warn('Failed to seek to timestamp:', error);
        // Final fallback: try iframe URL manipulation
        if (iframe) {
            updateIframeTimestamp(iframe, seconds);
        }
    }
}

// Helper function to update iframe timestamps
function updateIframeTimestamp(iframe, seconds) {
    const currentSrc = iframe.src;
    
    // Handle different video platforms
    if (currentSrc.includes('youtube.com/embed/')) {
        // For YouTube, we need to ensure autoplay is enabled and use the proper URL format
        let newSrc = currentSrc;
        
        // Ensure autoplay is enabled
        if (!newSrc.includes('autoplay=1')) {
            if (newSrc.includes('?')) {
                newSrc += '&autoplay=1';
            } else {
                newSrc += '?autoplay=1';
            }
        }
        
        // Handle start time parameter
        if (newSrc.includes('&start=') || newSrc.includes('?start=')) {
            newSrc = newSrc.replace(/[?&]start=\d+/, `${newSrc.includes('?') ? '&' : '?'}start=${seconds}`);
        } else {
            newSrc += `&start=${seconds}`;
        }
        
        // Force reload the iframe to apply changes
        iframe.src = newSrc;
        console.log(`Updated YouTube iframe to start at ${seconds}s with autoplay`);
        
    } else if (currentSrc.includes('drive.google.com')) {
        // Google Drive videos
        let newSrc = currentSrc;
        if (newSrc.includes('&t=')) {
            newSrc = newSrc.replace(/&t=\d+/, `&t=${seconds}`);
        } else {
            newSrc = newSrc + `&t=${seconds}`;
        }
        iframe.src = newSrc;
        console.log(`Updated Google Drive video to start at ${seconds}s`);
        
    } else {
        // For other iframe sources, try URL manipulation with autoplay
        let newSrc = currentSrc;
        
        // Try to add generic timestamp parameters
        if (newSrc.includes('?')) {
            newSrc += `&t=${seconds}&autoplay=1`;
        } else {
            newSrc += `?t=${seconds}&autoplay=1`;
        }
        
        iframe.src = newSrc;
        console.log(`Updated iframe to start at ${seconds}s with autoplay`);
    }
}

// Process description text and add timestamp links
function processTimestamps() {
    const descriptionElement = document.querySelector('#description p');
    if (!descriptionElement) return;
    
    const text = descriptionElement.innerHTML;
    
    // Enhanced regex to match timestamps in various formats
    // Matches: 0:00, 1:05, 12:34, 1:23:45, etc.
    // Uses word boundaries to avoid matching times in other contexts
    const timestampRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
    
    const processedText = text.replace(timestampRegex, (match, timestamp, offset, string) => {
        // Additional validation: make sure this looks like a proper timestamp
        const seconds = parseTimestamp(timestamp);
        if (seconds >= 0) {
            return `<button class="timestamp-link" type="button" data-time="${seconds}" title="Jump to ${timestamp}" aria-label="Jump to ${timestamp}">${timestamp}</button>`;
        }
        return match; // Return original if validation fails
    });
    
    if (processedText !== text) {
        descriptionElement.innerHTML = processedText;
        
        // Add event listeners to timestamp links
        const timestampLinks = descriptionElement.querySelectorAll('.timestamp-link');
        timestampLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const seconds = parseInt(link.dataset.time, 10);
                
                // Visual feedback on click
                link.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    link.style.transform = '';
                }, 150);
                
                seekToTimestamp(seconds);
            });
            
            // Add keyboard support
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    link.click();
                }
            });
        });
        
        console.log(`Processed ${timestampLinks.length} timestamp(s) in description`);
    }
}

// Initialize video player and timestamp functionality
function initializeVideoPlayer() {
    // Use scheduler for better prioritization
    scheduler.postTask(() => {
        const playerElement = document.getElementById('player');
        if (!playerElement) {
            // No player found, but still process timestamps
            processTimestamps();
            return;
        }
        
        // Determine player type based on the HTML structure
        if (playerElement.tagName === 'VIDEO') {
            // Direct video element - use native controls
            player = playerElement;
            playerType = 'video';
            console.log('Found native video element');
        } else if (playerElement.classList.contains('plyr__video-embed')) {
            // Embedded video (YouTube, etc.) - handle iframe directly
            const iframe = playerElement.querySelector('iframe');
            if (iframe) {
                if (iframe.src.includes('youtube.com')) {
                    playerType = 'youtube';
                    console.log('Found YouTube embed');
                } else {
                    playerType = 'iframe';
                    console.log('Found iframe embed');
                }
                player = iframe;
            }
        }
        
        // Process timestamps in description regardless of player type
        processTimestamps();
        
    }, { priority: 'user-visible' });
}

// Enhanced error handling for video player initialization
function handlePlayerError(error) {
    console.warn('Video player initialization error:', error);
    // Fallback: still process timestamps even if player fails to initialize
    processTimestamps();
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Use scheduler for better prioritization
    scheduler.postTask(() => {
        addTimestampStyles();
    }, { priority: 'user-blocking' });
    
    scheduler.postTask(() => {
        try {
            initializeVideoPlayer();
        } catch (error) {
            handlePlayerError(error);
        }
    }, { priority: 'user-visible' });
});

// Enhanced YouTube iframe API support
window.addEventListener('message', (event) => {
    // Listen for YouTube player state changes if needed
    if (event.origin === 'https://www.youtube.com' && playerType === 'youtube') {
        try {
            const data = JSON.parse(event.data);
            // Handle YouTube player events if needed for additional functionality
        } catch (e) {
            // Ignore non-JSON messages
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    // Clean up any event listeners or resources if needed
    player = null;
    playerType = null;
});