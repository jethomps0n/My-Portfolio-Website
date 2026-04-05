// Video Viewer JavaScript - Timestamp Functionality for Project Pages

let player = null;
let playerType = null; // 'video', 'youtube', 'iframe'
const timestampRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
const exactTimestampRegex = /^\d{1,2}:\d{2}(?::\d{2})?$/;

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
            // [DEBUGGING CODE]
            // console.log(`Seeking to ${seconds} seconds and playing native video element`);
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
        // [DEBUGGING CODE]
        // console.log(`Updated YouTube iframe to start at ${seconds}s with autoplay`);
        
    } else if (currentSrc.includes('drive.google.com')) {
        // Google Drive videos
        let newSrc = currentSrc;
        if (newSrc.includes('&t=')) {
            newSrc = newSrc.replace(/&t=\d+/, `&t=${seconds}`);
        } else {
            newSrc = newSrc + `&t=${seconds}`;
        }
        iframe.src = newSrc;
        // [DEBUGGING CODE]
        // console.log(`Updated Google Drive video to start at ${seconds}s`);
        
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
function createTimestampButton(timestamp, seconds) {
    const button = document.createElement('button');
    button.className = 'timestamp-link';
    button.type = 'button';
    button.dataset.time = String(seconds);
    button.title = `Jump to ${timestamp}`;
    button.setAttribute('aria-label', `Jump to ${timestamp}`);
    button.textContent = timestamp;
    return button;
}

function upgradeLegacyTimestampSpans(descriptionElement) {
    let hasChanges = false;
    const legacySpans = descriptionElement.querySelectorAll('.timestamp-text');

    legacySpans.forEach(span => {
        const rawTimestamp = (span.dataset.timestamp || span.textContent || '').trim();

        if (!exactTimestampRegex.test(rawTimestamp)) {
            return;
        }

        const seconds = parseTimestamp(rawTimestamp);
        if (Number.isNaN(seconds) || seconds < 0) {
            return;
        }

        span.replaceWith(createTimestampButton(rawTimestamp, seconds));
        hasChanges = true;
    });

    return hasChanges;
}

function replaceTimestampInTextNode(textNode) {
    const text = textNode.textContent;
    if (!text) {
        return false;
    }

    timestampRegex.lastIndex = 0;
    if (!timestampRegex.test(text)) {
        return false;
    }

    timestampRegex.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let hasReplacements = false;
    let match;

    while ((match = timestampRegex.exec(text)) !== null) {
        const matchedTimestamp = match[0];
        const startIndex = match.index;
        const endIndex = startIndex + matchedTimestamp.length;
        const seconds = parseTimestamp(matchedTimestamp);

        if (Number.isNaN(seconds) || seconds < 0) {
            continue;
        }

        if (startIndex > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, startIndex)));
        }

        fragment.appendChild(createTimestampButton(matchedTimestamp, seconds));
        lastIndex = endIndex;
        hasReplacements = true;
    }

    if (!hasReplacements) {
        return false;
    }

    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.replaceWith(fragment);
    return true;
}

function convertTextNodeTimestamps(descriptionElement) {
    const walker = document.createTreeWalker(descriptionElement, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node = walker.nextNode();

    while (node) {
        const parentElement = node.parentElement;
        if (parentElement && !parentElement.closest('.timestamp-link, .timestamp-text, script, style')) {
            textNodes.push(node);
        }
        node = walker.nextNode();
    }

    let hasChanges = false;
    textNodes.forEach(textNode => {
        if (replaceTimestampInTextNode(textNode)) {
            hasChanges = true;
        }
    });

    return hasChanges;
}

function bindTimestampHandlers(descriptionElement) {
    if (descriptionElement.dataset.timestampHandlersBound === 'true') {
        return;
    }

    descriptionElement.addEventListener('click', event => {
        const clickedElement = event.target instanceof Element
            ? event.target.closest('.timestamp-link')
            : null;

        if (!clickedElement || !descriptionElement.contains(clickedElement)) {
            return;
        }

        const seconds = parseInt(clickedElement.dataset.time, 10);
        if (Number.isNaN(seconds)) {
            return;
        }

        // Visual feedback on click
        clickedElement.style.transform = 'scale(0.95)';
        setTimeout(() => {
            clickedElement.style.transform = '';
        }, 150);

        seekToTimestamp(seconds);
    });

    descriptionElement.dataset.timestampHandlersBound = 'true';
}

function processTimestamps() {
    const descriptionElement = document.querySelector('#description p');
    if (!descriptionElement) return;

    const convertedLegacySpans = upgradeLegacyTimestampSpans(descriptionElement);
    const convertedTextNodes = convertTextNodeTimestamps(descriptionElement);
    const hasTimestampLinks = descriptionElement.querySelector('.timestamp-link');

    if (convertedLegacySpans || convertedTextNodes || hasTimestampLinks) {
        bindTimestampHandlers(descriptionElement);
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
            // [DEBUGGING CODE]
            // console.log('Found native video element');
        } else if (playerElement.classList.contains('plyr__video-embed')) {
            // Embedded video (YouTube, etc.) - handle iframe directly
            const iframe = playerElement.querySelector('iframe');
            if (iframe) {
                if (iframe.src.includes('youtube.com')) {
                    playerType = 'youtube';
                    // [DEBUGGING CODE]
                    // console.log('Found YouTube embed');
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
    // [DEBUGGING CODE]
    // console.warn('Video player initialization error:', error);
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