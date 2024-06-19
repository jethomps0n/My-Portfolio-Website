const contentContainer = document.querySelectorAll('.contentContainer');
let hoverDelay = 600; //ms
let timeout;

// Start the video from the beginning after 'hoverDelay' milleseconds
const vidStart = event => {
    const video = event.currentTarget.querySelector('.passive');
    if (video.checkVisibility({visibilityProperty: false})) {
        timeout = setTimeout(() => {
            video.currentTime = 0;
            video.play();
        }, hoverDelay);
    }
};

// Pause the video, clear 'timeout'
const vidStop = event => {
    const video = event.currentTarget.querySelector('.passive');
    if (video.checkVisibility({visibilityProperty: false})) {
        clearTimeout(timeout);
        video.pause();
        // video.src = video.src;
    }
};

contentContainer.forEach(element => {
    // Call 'vidStart' when hovering mouse over 'contentContainer'
    element.addEventListener('mouseenter', vidStart);
    // Call 'vidStop' when exiting mouse from 'contentContainer'
    element.addEventListener('mouseleave', vidStop);
});