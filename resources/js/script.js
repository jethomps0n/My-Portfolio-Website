const contentContainer = document.querySelectorAll('.contentContainer');

const vidOn = event => {
    const video = event.currentTarget.querySelector('.passive');
    if (video.checkVisibility({visibilityProperty: false})) {
        video.currentTime = 0;
        video.play();
    }
};

const vidOff = event => {
    const video = event.currentTarget.querySelector('.passive');
    if (video.checkVisibility({visibilityProperty: false})) {
        video.pause();
    }
};

contentContainer.forEach(element => {
    element.addEventListener('mouseenter', vidOn);
    element.addEventListener('mouseleave', vidOff);
});