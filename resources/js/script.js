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

const loadMoreButton = document.querySelector('.button');
const contentBoxIncrease = 3;
const unloadBox = Array.from(document.querySelectorAll('.unloaded'));

const load = event => {
    for (let i=0; i < contentBoxIncrease; i++) {
        if (unloadBox[0] == undefined) {
            loadMoreButton.disabled = true;
            loadMoreButton.classList.add('loadAll');
            loadMoreButton.innerHTML = `You've reached the end of the page.`;
            break;
        }
        unloadBox.shift().classList.remove('unloaded');
    }
};

loadMoreButton.addEventListener('click', load);

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