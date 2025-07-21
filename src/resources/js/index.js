const contentContainer = document.querySelectorAll('.contentContainer');
let hoverDelay = 600; //ms
let timeout;

// Detect touch device
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// Only enable video preview hover for non-touch devices
if (!isTouchDevice) {
    // Optimized video handling with requestAnimationFrame for better INP
    const vidStart = event => {
        const video = event.currentTarget.querySelector('.passive');
        if (video && video.checkVisibility({visibilityProperty: false})) {
            timeout = setTimeout(() => {
                // Use scheduler.postTask for better prioritization
                scheduler.postTask(() => {
                    video.currentTime = 0;
                    video.play().catch(() => {}); // Silently handle play failures
                }, { priority: 'user-visible' });
            }, hoverDelay);
        }
    };

    // Optimized video pause with scheduler
    const vidStop = event => {
        const video = event.currentTarget.querySelector('.passive');
        if (video && video.checkVisibility({visibilityProperty: false})) {
            clearTimeout(timeout);
            scheduler.postTask(() => {
                video.pause();
            }, { priority: 'user-visible' });
        }
    };

    // Use passive listeners for better scroll performance and batch event listener setup
    contentContainer.forEach(element => {
        element.addEventListener('mouseenter', vidStart, { passive: true });
        element.addEventListener('mouseleave', vidStop, { passive: true });
    });
} else {
    // On touch devices, ensure video previews are always hidden and thumbnails are always visible
    contentContainer.forEach(element => {
        const activeThumb = element.querySelector('.thumbnail.active');
        const passiveThumb = element.querySelector('.thumbnail.passive');
        if (activeThumb) {
            activeThumb.style.opacity = '1';
            activeThumb.style.visibility = 'visible';
        }
        if (passiveThumb) {
            passiveThumb.style.opacity = '0';
            passiveThumb.style.visibility = 'hidden';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Optimized animation cleanup with passive listeners and batching
    const popInElements = document.querySelectorAll('.contentContainer.pop-in');
    popInElements.forEach(el => {
        el.addEventListener('animationend', () => {
            el.classList.remove('pop-in');
        }, { once: true, passive: true });
    });
    
    const contentWrapper = document.getElementById('content'); 
    const loadMoreButton = document.querySelector('.button'); 
    let contentData = []; // Store fetched JSON data
    let loadIndex = 3; // Track how many items have been loaded

    // Optimized data fetching with better error handling and yielding
    async function loadData() {
        try {
            const response = await fetch('/resources/json/data.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            console.log("Fetched Data:", data);
            
            // Yield control while processing data to improve INP
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Sort data by date (newest first) to match Eleventy template
            contentData = data
                .filter(item => item.Screenplay !== "Sole") // Filter out "Sole" items to match Eleventy
                .sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    return dateB - dateA; // Newest first (descending order)
                });
        } catch (error) {
            console.error("Error loading data.json:", error);
        }
    }

    // Initialize data loading
    loadData();

    // Optimized content loading with yielding for better INP
    const load = async () => {
        for (let i = 0; i < 3; i++) {
            if (loadIndex >= contentData.length) {
                loadMoreButton.disabled = true;
                loadMoreButton.classList.add('loadAll');
                loadMoreButton.innerHTML = "You've reached the end of the page.";
                return;
            }
            
            // Yield between content additions to prevent blocking
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            addContent(contentData[loadIndex]);
            loadIndex++;
        }

        if (loadIndex >= contentData.length) {
            loadMoreButton.disabled = true;
            loadMoreButton.classList.add('loadAll');
            loadMoreButton.innerHTML = "You've reached the end of the page.";
            return;
        }
    };

    // Optimized content creation with requestAnimationFrame for DOM updates
    const addContent = (data) => {
        requestAnimationFrame(() => {
            const newContentContainer = document.createElement('div');
            newContentContainer.classList.add('contentContainer', 'pop-in');

            const rolesArray = data.role ? data.role.split('/') : [];
            
            const rolesHTML = rolesArray.map((r) =>
                `<a class="role-tag" href="/explore/?roles=${encodeURIComponent(r)}">${r}</a>`).join('');

            newContentContainer.innerHTML = `
                <a class="frame" href="/explore/${data.slug}">
                    <img class="thumbnail active" src="${data.imgSrc}" alt="" loading="lazy">
                    <video class="thumbnail passive" src="${data.previewSrc}" muted loop preload="none"></video>
                </a>
                <div class="info">
                    <a class="expand" href="/explore/${data.slug}"></a>
                    <h2 class="contentTitle">${data.title}</h2>
                    <h3 class="date">${data.date}</h3>
                    <div class="roles">${rolesHTML}</div>
                </div>
            `;

            contentWrapper.appendChild(newContentContainer);

            // Clean up animation class after it runs
            setTimeout(() => {
                newContentContainer.classList.remove('pop-in');
            }, 400);

            // Add optimized event listeners with passive options
            newContentContainer.addEventListener('mouseenter', vidStart, { passive: true });
            newContentContainer.addEventListener('mouseleave', vidStop, { passive: true });
        });
    };
    
    // Optimized load more button with async handling
    loadMoreButton.addEventListener('click', async () => {
        if (contentData.length > 0) {
            await load();
        }
    });
});