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

document.addEventListener('DOMContentLoaded', () => {
    const contentWrapper = document.getElementById('content'); 
    const loadMoreButton = document.querySelector('.button'); 
    let contentData = []; // Store fetched JSON data
    let loadIndex = 0; // Track how many items have been loaded

    // Fetch the data from data.json
    fetch('/resources/json/data.json')
        .then(response => response.json()) 
        .then(data => {
            console.log("Fetched Data:", data); // Debugging: Log fetched data
            contentData = data; // Store data
            load(); // Load first 3 items
        })
        .catch(error => console.error("Error loading data.json:", error));

    // Function to load content in increments of 3
    const load = () => {
        for (let i = 0; i < 3; i++) {
            if (loadIndex >= contentData.length) {
                loadMoreButton.disabled = true;
                loadMoreButton.classList.add('loadAll');
                loadMoreButton.innerHTML = "You've reached the end of the page.";
                return;
            }
            addContent(contentData[loadIndex]); // Add content
            loadIndex++;
        }

        if (loadIndex >= contentData.length) {
            loadMoreButton.disabled = true;
            loadMoreButton.classList.add('loadAll');
            loadMoreButton.innerHTML = "You've reached the end of the page.";
            return;
        }
    };

    // Function to create and append content
    const addContent = (data) => {
        const newContentContainer = document.createElement('div');
        newContentContainer.classList.add('contentContainer');

        newContentContainer.innerHTML = `
            <a class="frame" href="#!">
                <img class="thumbnail active" src="${data.imgSrc}" alt="">
                <video class="thumbnail passive" src="${data.videoSrc}" muted loop></video>
            </a>
            <div class="info">
                <a class="expand" href="#!"></a>
                <h2 class="contentTitle">${data.title}</h2>
                <h3 class="date">${data.date}</h3>
                <h3 class="role">${data.role}</h3>
                <a class="credits" href="#!">Credits</a>
            </div>
        `;

        contentWrapper.appendChild(newContentContainer);

        // Call 'vidStart' when hovering mouse over 'contentContainer'
        newContentContainer.addEventListener('mouseenter', vidStart);
        // Call 'vidStop' when exiting mouse from 'contentContainer'
        newContentContainer.addEventListener('mouseleave', vidStop);
    };

    // Wait for content.json to load before adding event listener
    loadMoreButton.addEventListener('click', () => {
        if (contentData.length > 0) {
            load();
        }
    });
});

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