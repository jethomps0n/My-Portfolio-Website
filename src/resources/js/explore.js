const itemsPerPage = 5;
let allData = [];
let filtered = [];
let currentPage = 1;
let selectedRoles = new Set();
let selectedTypes = new Set();
let dateRange = {start:null,end:null};
let selectedDateRadio = null;
let searchText = '';
let sortMode = 'newest';
let firstRender = true;

// Video preview hover behavior
let hoverDelay = 600; // ms
let hoverTimeout;

// Performance optimizations for INP
let updateTimeout = null;
let renderTimeout = null;
const BATCH_SIZE = 3; // Process items in batches
const FRAME_BUDGET = 16; // 16ms per frame (60fps)

// Device detection (robust)
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Video preview functions (desktop only)
let previewStart = null;
let previewStop = null;
if (!isTouchDevice) {
    previewStart = event => {
        const video = event.currentTarget.querySelector('.thumbnail.passive');
        if (video && video.checkVisibility({visibilityProperty: false})) {
            hoverTimeout = setTimeout(() => {
                video.currentTime = 0;
                video.play().catch(() => {}); // Handle play failures silently
            }, hoverDelay);
        }
    };
    previewStop = event => {
        const video = event.currentTarget.querySelector('.thumbnail.passive');
        if (video) {
            clearTimeout(hoverTimeout);
            video.pause();
        }
    };
}

function parseDate(str){
    const d = new Date(str);
    return d;
}

// Optimized data loading with better error handling and yielding
async function loadData(){
    try {
        const response = await fetch('/resources/json/data.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Yield control during data processing to improve INP
        await scheduler.postTask(() => {
            allData = data;
        }, { priority: 'user-blocking' });
        
        update();
    } catch (err) {
        console.error('Failed to load data.json', err);
    }
}
        // [DEBUGGING CODE]
        // console.error('Failed to load data.json', err);

function applyURL(){
    const params=new URLSearchParams(location.search);
    const q=params.get('q')||'';
    searchText=q.toLowerCase();
    document.getElementById('search-input').value=q;
    document.getElementById('clear-search').style.display=q?'block':'none';

    const roles=params.get('roles');
    if(roles){
        roles.split(',').forEach(v=>{if(v){selectedRoles.add(v);const el=document.querySelector(`#filter-role input[value="${v}"]`);if(el) el.checked=true;}});
    }
    const types=params.get('types');
    if(types){
        types.split(',').forEach(v=>{if(v){selectedTypes.add(v);const el=document.querySelector(`#filter-type input[value="${v}"]`);if(el) el.checked=true;}});
    }
    const start=params.get('start');
    const end=params.get('end');
    if(start&&end){
        dateRange.start=new Date(start+'T00:00');
        dateRange.end=new Date(end+'T23:59');
        document.getElementById('start-date').value=start;
        document.getElementById('end-date').value=end;
    }

    sortMode=params.get('sort')||'newest';
    document.getElementById('sort-select').value=sortMode;

    currentPage=parseInt(params.get('page')||'1',10);
}

function updateURL(){
    const urlParts = [];
    
    if(searchText) urlParts.push(`q=${encodeURIComponent(searchText)}`);
    if(selectedRoles.size>0) urlParts.push(`roles=${encodeURIComponent(Array.from(selectedRoles).join(','))}`);
    if(selectedTypes.size>0) urlParts.push(`types=${encodeURIComponent(Array.from(selectedTypes).join(','))}`);
    if(dateRange.start&&dateRange.end){
        urlParts.push(`start=${encodeURIComponent(dateRange.start.toISOString().split('T')[0])}`);
        urlParts.push(`end=${encodeURIComponent(dateRange.end.toISOString().split('T')[0])}`);
    }
    if(sortMode!=='newest') urlParts.push(`sort=${encodeURIComponent(sortMode)}`);
    if(currentPage>1) urlParts.push(`page=${encodeURIComponent(currentPage)}`);
    
    const queryString = urlParts.join('&');
    const newUrl = location.pathname + (queryString ? `?${queryString}` : '');
    history.replaceState(null,'',newUrl);
}

document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.pop-in').forEach(el=>{
        el.addEventListener('animationend',()=>el.classList.remove('pop-in'),{once:true});
    });
    
    // Add smooth staggered animation for category expansion
    document.querySelectorAll('.filter-group .options').forEach((o, index) => {
        setTimeout(() => {
            o.classList.add('expanded');
        }, index * 100); // 100ms delay between each category
    });
    
    bindEvents();
    initMobileFilters();
    applyURL();
    loadData();
});

// Optimized event binding with passive listeners and debouncing
function bindEvents(){
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    
    // Existing debounced search code
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchText = searchInput.value.trim().toLowerCase();
            clearSearch.style.display = searchText ? 'block' : 'none';
            currentPage = 1;
            update();
        }, 150);
    }, { passive: true });
    
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchText = '';
        clearSearch.style.display = 'none';
        currentPage = 1;
        update();
    });

    // Only enable video preview hover for non-touch devices
    if (!isTouchDevice) {
        // Attach event listeners for hover only on non-touch devices
        document.querySelectorAll('.thumbnail').forEach(el => {
            el.addEventListener('mouseenter', previewStart, { passive: true });
        el.addEventListener('mouseleave', previewStop, { passive: true });
    });
}
    // Optimized focus handlers
    searchInput.addEventListener('focus', () => {
        requestAnimationFrame(() => {
            document.body.classList.add('input-focus');
            if (typeof cursor !== 'undefined' && cursor.hide) {
                cursor.hide();
            }
        });
    });
    
    searchInput.addEventListener('blur', () => {
        requestAnimationFrame(() => {
            document.body.classList.remove('input-focus');
            if (typeof cursor !== 'undefined' && cursor.show) {
                cursor.show();
            }
        });
    });

    // Optimized checkbox handlers with yielding
    document.querySelectorAll('#filter-role input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', async () => {
            if (cb.checked) {
                selectedRoles.add(cb.value);
            } else {
                selectedRoles.delete(cb.value);
            }
            currentPage = 1;
            
            // Yield control before updating to improve INP
            await new Promise(resolve => setTimeout(resolve, 0));
            update();
        });
    });
    
    function setupShowMore(id){
        const group = document.getElementById(id);
        const btn = group.querySelector('.show-more');
        const more = group.querySelector('.more');
        
        btn.addEventListener('click', () => {
            const expanding = !more.classList.contains('expanded');
            
            if (expanding) {
                more.classList.add('expanded');
                btn.classList.add('expanded');
                btn.querySelector('.text').textContent = 'Show Less';
            } else {
                more.classList.remove('expanded');
                btn.classList.remove('expanded');
                btn.querySelector('.text').textContent = 'Show More';
            }
        });
    }
    
    setupShowMore('filter-role');

    // Optimized type filter handlers
    document.querySelectorAll('#filter-type input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', async () => {
            if (cb.checked) {
                selectedTypes.add(cb.value);
            } else {
                selectedTypes.delete(cb.value);
            }
            currentPage = 1;
            
            // Yield control before updating
            await new Promise(resolve => setTimeout(resolve, 0));
            update();
        });
    });
    
    setupShowMore('filter-type');

    // Optimized filter group toggles with requestAnimationFrame
    document.querySelectorAll('.filter-group .toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            requestAnimationFrame(() => {
                const group = btn.closest('.filter-group');
                const opts = group.querySelector('.options');
                const expanded = btn.classList.toggle('open');
                
                if (expanded) {
                    opts.classList.add('expanded');
                    btn.setAttribute('aria-expanded', 'true');
                } else {
                    opts.classList.remove('expanded');
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        });
    });

    // Optimized date filter handlers
    document.querySelectorAll('#filter-date input[type=radio]').forEach(r => {
        r.addEventListener('click', () => {
            if (selectedDateRadio === r) {
                r.checked = false;
                selectedDateRadio = null;
                dateRange = {start: null, end: null};
                update();
            } else {
                selectedDateRadio = r;
            }
        });
        
        r.addEventListener('change', () => {
            if(r.checked){
                const now = new Date();
                now.setHours(23,59,59,999);
                dateRange.end=now;
                const start=new Date(now.getTime()-parseInt(r.value)*24*60*60*1000);
                start.setHours(0,0,0,0);
                dateRange.start=start;
                document.getElementById('start-date').value='';
                document.getElementById('end-date').value='';
                currentPage=1;update();
            }
        });
    });
    document.getElementById('set-custom').addEventListener('click',()=>{
        const s=document.getElementById('start-date').value;
        const e=document.getElementById('end-date').value;
        if(s&&e){
            dateRange.start=new Date(s+'T00:00');
            dateRange.end=new Date(e+'T23:59');
            document.querySelectorAll('#filter-date input[type=radio]').forEach(r=>r.checked=false);
            currentPage=1;update();
        }
    });

    document.getElementById('sort-select').addEventListener('change',e=>{sortMode=e.target.value;currentPage=1;update();});
    document.getElementById('clear-filters').addEventListener('click',()=>{
        selectedRoles.clear();
        selectedTypes.clear();
        dateRange={start:null,end:null};
        document.querySelectorAll('#filter-section input').forEach(i=>{if(i.type==='checkbox'||i.type==='radio'){i.checked=false;}});
        document.getElementById('start-date').value='';
        document.getElementById('end-date').value='';
        currentPage=1;update();
    });
}

// Optimized update function with better scheduling for INP
async function update(){
    // Use scheduler.postTask for better prioritization
    await scheduler.postTask(async () => {
        // Filter data in chunks to avoid blocking
        const startTime = performance.now();
        filtered = [];
        
        for (let i = 0; i < allData.length; i += BATCH_SIZE) {
            const batch = allData.slice(i, i + BATCH_SIZE);
            const batchFiltered = batch.filter(item => {
                if(searchText && !(`${item.title} ${item.description}`.toLowerCase().includes(searchText))) return false;
                if(selectedRoles.size>0){
                    const r=item.role||'';
                    const roleList=r.split('/').map(s=>s.trim()).filter(Boolean);
                    let match=false;
                    for(const val of selectedRoles){
                        if(roleList.includes(val)){ match=true; break; }
                    }
                    if(!match) return false;
                }
                if(selectedTypes.size>0){
                    if(!selectedTypes.has(item.type)) return false;
                }
                if(dateRange.start && dateRange.end){
                    const d=parseDate(item.date);
                    if(d<dateRange.start||d>dateRange.end) return false;
                }
                return true;
            });
            
            filtered.push(...batchFiltered);
            
            // Yield if we've used too much time
            if (performance.now() - startTime > FRAME_BUDGET) {
                await scheduler.postTask(() => {}, { priority: 'user-visible' });
            }
        }
        
        sortData();
    }, { priority: 'user-blocking' });
    
    // Render in separate tasks to maintain responsiveness
    await scheduler.postTask(() => {
        renderFilters();
    }, { priority: 'user-visible' });
    
    await scheduler.postTask(() => {
        renderResults();
        updateURL();
    }, { priority: 'user-visible' });
}

function sortData(){
    if(sortMode==='newest'){
        filtered.sort((a,b)=>parseDate(b.date)-parseDate(a.date));
    }else if(sortMode==='oldest'){
        filtered.sort((a,b)=>parseDate(a.date)-parseDate(b.date));
    }else if(sortMode==='az'){
        filtered.sort((a,b)=>a.title.localeCompare(b.title));
    }else if(sortMode==='za'){
        filtered.sort((a,b)=>b.title.localeCompare(a.title));
    }
}

function renderFilters(){
    const container=document.getElementById('active-filters');
    container.innerHTML='';
    let count=0;
    const parts=[];
    if(selectedRoles.size>0){
        const span=document.createElement('span');
        span.classList.add('active-filter-group');
        span.innerHTML='<strong>ROLE:</strong> ';
        selectedRoles.forEach(val=>{span.appendChild(makeTag(val,'role'));count++;});
        parts.push(span);
    }
    if(selectedTypes.size>0){
        const span=document.createElement('span');
        span.classList.add('active-filter-group');
        span.innerHTML='<strong>TYPE:</strong> ';
        selectedTypes.forEach(val=>{span.appendChild(makeTag(val,'type'));count++;});
        parts.push(span);
    }
    if(dateRange.start && dateRange.end){
        const span=document.createElement('span');
        span.classList.add('active-filter-group');
        span.innerHTML='<strong>DATE RANGE:</strong> ';
        span.appendChild(makeTag(`${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`,'date'));
        parts.push(span);
        count++;
    }
    parts.forEach((p,i)=>{
        container.appendChild(p);
        if(i < parts.length - 1) {
            const comma = document.createElement('span');
            comma.className = 'filter-comma';
            comma.textContent = ',';
            container.appendChild(comma);
        }
    });
    document.getElementById('filter-count').textContent=count;
    container.style.display = parts.length ? 'block' : 'none';
}

function makeTag(text,kind){
    const span=document.createElement('span');
    span.className='active-filter';
    span.textContent=text;
    const btn=document.createElement('button');
    btn.textContent='⨯';
    btn.addEventListener('click',()=>{
        if(kind==='role') selectedRoles.delete(text);
        if(kind==='type') selectedTypes.delete(text);
        if(kind==='date') {
            dateRange={start:null,end:null};
            document.querySelectorAll('#filter-date input[type=radio]').forEach(r=>r.checked=false);
        }
        document.querySelectorAll('#filter-section input').forEach(i=>{
            if(i.value===text && (i.type==='checkbox'||i.type==='radio')) i.checked=false;
        });
        currentPage=1;update();
    });
    span.appendChild(btn);
    return span;
}

function makeRoleTag(text){
    const span=document.createElement('span');
    span.className='role-tag';
    span.textContent=text;
    span.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        selectedRoles.clear();
        selectedTypes.clear();
        dateRange={start:null,end:null};
        document.querySelectorAll('#filter-section input').forEach(i=>{
            if(i.type==='checkbox'||i.type==='radio') i.checked=false;
        });
        selectedRoles.add(text);
        const el=document.querySelector(`#filter-role input[value="${text}"]`);
        if(el) el.checked=true;
        currentPage=1;update();
        scrollToTop();
    });
    return span;
}

// Optimized results rendering with requestAnimationFrame and lazy loading
async function renderResults(){
    const results = document.getElementById('results-list');
    results.innerHTML = '';
    const total = filtered.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, total);
    const slice = filtered.slice(startIndex, endIndex);
    
    // Use requestAnimationFrame for DOM updates and batch processing
    await new Promise(resolve => {
        requestAnimationFrame(async () => {
            for (let i = 0; i < slice.length; i++) {
                const item = slice[i];
                const div = document.createElement('div');
                div.className = 'result-item ' + (firstRender ? 'pop-in' : 'fade-in');

                const a = document.createElement('a');
                a.href = `/explore/${item.slug}` || '#';
                a.setAttribute('aria-label', `Go to ${item.title}`);
                const hasScreenplay = item.Screenplay === 'Yes' || item.Screenplay === 'Sole';
                let thumbClass = hasScreenplay ? 'thumb screenplay-attached' : 'thumb';

                // Add version badge to screenplay-attached class if versioning is enabled
                if (hasScreenplay && (item.versioning === 'Yes' || item.versioning === 'Completed')) {
                    const version = (item.versionInfo && item.versionInfo.currentVersion) ? item.versionInfo.currentVersion : 1;
                    thumbClass += ` versioned v${version}`;
                }

                const disablePreview = item.Screenplay === 'Sole';

                // Create the thumbnail HTML with lazy loading optimization
                const thumbDiv = document.createElement('div');
                thumbDiv.className = thumbClass;

                // On touch devices, always render only the <img> and never the <video>
                if (isTouchDevice || disablePreview) {
                    thumbDiv.innerHTML = `<img class="thumbnail active" src="${item.imgSrc}" alt="${item.title} thumbnail" loading="lazy">`;
                    a.classList.add('no-preview');
                } else {
                    thumbDiv.innerHTML = `<img class="thumbnail active" src="${item.imgSrc}" alt="${item.title} thumbnail" loading="lazy"><video class="thumbnail passive" src="${item.previewSrc}" muted loop preload="none"></video>`;
                }

                // Add video preview event listeners ONLY if preview is not disabled and not touch device
                if (!disablePreview && !isTouchDevice && previewStart && previewStop) {
                    a.addEventListener('mouseenter', previewStart);
                    a.addEventListener('mouseleave', previewStop);
                }

                // Add screenplay/version badges if needed
                if (hasScreenplay) {
                    const badgeWrapper = document.createElement('div');
                    badgeWrapper.className = 'badge-wrapper';

                    // Create screenplay badge
                    const screenplayBadge = document.createElement('span');
                    screenplayBadge.className = 'screenplay-badge';
                    screenplayBadge.textContent = 'Screenplay Attached';

                    // Add version badge if versioned
                    if (item.versioning === 'Yes' || item.versioning === 'Completed') {
                        const version = (item.versionInfo && item.versionInfo.currentVersion) ? item.versionInfo.currentVersion : 1;

                        const versionBadge = document.createElement('span');
                        versionBadge.className = 'version-badge';
                        versionBadge.textContent = `v${version}`;

                        badgeWrapper.appendChild(screenplayBadge);
                        badgeWrapper.appendChild(versionBadge);
                    } else {
                        badgeWrapper.appendChild(screenplayBadge);
                    }

                    thumbDiv.appendChild(badgeWrapper);
                }

                a.appendChild(thumbDiv);

                const info = document.createElement('div');
                info.className = 'result-info';
                const h3 = document.createElement('h3');
                h3.textContent = item.title;
                info.appendChild(h3);

                // Check if we're in mobile layout (870px and below)
                const isMobileLayout = window.innerWidth <= 870;

                if (isMobileLayout) {
                    // Mobile layout: separate date and roles elements
                    const dateElement = document.createElement('small');
                    dateElement.className = 'date';
                    dateElement.textContent = item.date;
                    info.appendChild(dateElement);

                    // Create roles container
                    const rolesContainer = document.createElement('div');
                    rolesContainer.className = 'roles';
                    const roles = (item.role || '').split('/').map(s => s.trim()).filter(Boolean);
                    roles.forEach(r => {
                        rolesContainer.appendChild(makeRoleTag(r));
                    });
                    info.appendChild(rolesContainer);
                } else {
                    // Desktop layout: inline date and roles with dot separator
                    const small = document.createElement('small');
                    const roles = (item.role || '').split('/').map(s => s.trim()).filter(Boolean);
                    roles.forEach(r => {
                        small.appendChild(makeRoleTag(r));
                    });
                    if (roles.length > 0) small.appendChild(document.createTextNode(' · '));
                    small.appendChild(document.createTextNode(item.date));
                    info.appendChild(small);
                }

                const p = document.createElement('p');

                // Handle newlines in description
                const description = item.description || '';
                if (description.includes('\n')) {
                    const lines = description.split('\n');
                    lines.forEach((line, index) => {
                        if (index > 0) {
                            p.appendChild(document.createElement('br'));
                        }
                        p.appendChild(document.createTextNode(line));
                    });
                } else {
                    p.textContent = description;
                }
                info.appendChild(p);
                a.appendChild(info);

                div.appendChild(a);
                div.addEventListener('animationend', () => {
                    div.classList.remove('pop-in', 'fade-in');
                }, { once: true });
                results.appendChild(div);

                // Yield control every 2 items to prevent blocking
                if (i % 2 === 1 && i < slice.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            document.getElementById('results-count').innerHTML = `Results <b>${startIndex + 1}</b>-<b>${endIndex}</b> of <b>${total}</b>`;
            renderPagination(total);
            updateURL();
            firstRender = false;
            resolve();
        });
    });
}

function scrollToTop(){
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function renderPagination(total){
    const pag=document.getElementById('pagination');
    pag.innerHTML='';
    const totalPages=Math.ceil(total/itemsPerPage)||1;
    const prev=document.createElement('button');
    prev.textContent='‹';
    prev.disabled=currentPage===1;
    prev.setAttribute('aria-label', 'Previous page');
    prev.addEventListener('click',()=>{
        if(currentPage>1){
            currentPage--;
            renderResults();
            scrollToTop();
        }
    });
    pag.appendChild(prev);
    const start=Math.max(1,currentPage-2);
    const end=Math.min(totalPages,start+4);
    for(let i=start;i<=end;i++){
        const b=document.createElement('button');
        b.textContent=i;
        b.setAttribute('aria-label', `Go to page ${i}`);
        if(i===currentPage) b.disabled=true;
        b.addEventListener('click',()=>{
            currentPage=i;
            renderResults();
            scrollToTop();
        });
        pag.appendChild(b);
    }
    const next=document.createElement('button');
    next.textContent='›';
    next.disabled=currentPage===totalPages;
    next.setAttribute('aria-label', 'Next page');
    next.addEventListener('click',()=>{
        if(currentPage<totalPages){
            currentPage++;
            renderResults();
            scrollToTop();
        }
    });
    pag.appendChild(next);
}

// Mobile filter popup functionality
function initMobileFilters() {
    const mobileFiltersBtn = document.getElementById('mobile-filters-btn');
    const mobileFilterPopup = document.getElementById('mobile-filter-popup');
    const mobileFilterOverlay = document.getElementById('mobile-filter-overlay');
    const mobileFilterClose = document.getElementById('mobile-filter-close');
    const mobileFilterContent = document.getElementById('mobile-filter-content');
    const mobileClearFilters = document.getElementById('mobile-clear-filters');
    
    // Clone desktop filter content to mobile popup
    function populateMobileFilters() {
        const desktopFilters = document.getElementById('filter-section');
        const filterGroups = desktopFilters.querySelectorAll('.filter-group');
        
        // Clear existing content
        mobileFilterContent.innerHTML = '';
        
        // Clone each filter group
        filterGroups.forEach(group => {
            const clonedGroup = group.cloneNode(true);
            
            // Update IDs to avoid conflicts
            if (clonedGroup.id) {
                clonedGroup.id = 'mobile-' + clonedGroup.id;
            }
            
            const inputs = clonedGroup.querySelectorAll('input');
            inputs.forEach(input => {
                if (input.id) {
                    input.id = 'mobile-' + input.id;
                }
            });
            
            const buttons = clonedGroup.querySelectorAll('button[id]');
            buttons.forEach(button => {
                if (button.id) {
                    button.id = 'mobile-' + button.id;
                }
            });
            
            mobileFilterContent.appendChild(clonedGroup);
        });
        
        // Bind events to cloned elements
        bindMobileFilterEvents();
    }
    
    // Bind events to mobile filter elements
    function bindMobileFilterEvents() {
        // Role checkboxes
        mobileFilterContent.querySelectorAll('#mobile-filter-role input[type=checkbox]').forEach(cb => {
            cb.addEventListener('change', () => {
                const originalCb = document.querySelector(`#filter-role input[value="${cb.value}"]`);
                if (originalCb) {
                    originalCb.checked = cb.checked;
                    originalCb.dispatchEvent(new Event('change'));
                }
            });
        });
        
        // Type checkboxes
        mobileFilterContent.querySelectorAll('#mobile-filter-type input[type=checkbox]').forEach(cb => {
            cb.addEventListener('change', () => {
                const originalCb = document.querySelector(`#filter-type input[value="${cb.value}"]`);
                if (originalCb) {
                    originalCb.checked = cb.checked;
                    originalCb.dispatchEvent(new Event('change'));
                }
            });
        });
        
        // Date radio buttons
        mobileFilterContent.querySelectorAll('#mobile-filter-date input[type=radio]').forEach(radio => {
            radio.addEventListener('change', () => {
                const originalRadio = document.querySelector(`#filter-date input[value="${radio.value}"]`);
                if (originalRadio) {
                    originalRadio.checked = radio.checked;
                    originalRadio.dispatchEvent(new Event('change'));
                }
            });
        });
        
        // Date range inputs
        const mobileStartDate = mobileFilterContent.querySelector('#mobile-start-date');
        const mobileEndDate = mobileFilterContent.querySelector('#mobile-end-date');
        const mobileSetCustom = mobileFilterContent.querySelector('#mobile-set-custom');
        
        if (mobileSetCustom) {
            mobileSetCustom.addEventListener('click', () => {
                const originalStartDate = document.getElementById('start-date');
                const originalEndDate = document.getElementById('end-date');
                
                if (originalStartDate && originalEndDate && mobileStartDate && mobileEndDate) {
                    originalStartDate.value = mobileStartDate.value;
                    originalEndDate.value = mobileEndDate.value;
                    document.getElementById('set-custom').click();
                }
            });
        }
        
        // Show more/less toggles
        mobileFilterContent.querySelectorAll('.show-more').forEach(btn => {
            btn.addEventListener('click', () => {
                const more = btn.parentElement.querySelector('.more');
                const expanding = !more.classList.contains('expanded');
                
                if (expanding) {
                    more.classList.add('expanded');
                    btn.classList.add('expanded');
                    btn.querySelector('.text').textContent = 'Show Less';
                } else {
                    more.classList.remove('expanded');
                    btn.classList.remove('expanded');
                    btn.querySelector('.text').textContent = 'Show More';
                }
            });
        });
        
        // Filter group toggles
        mobileFilterContent.querySelectorAll('.filter-group .toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.filter-group');
                const opts = group.querySelector('.options');
                const expanded = btn.classList.toggle('open');
                
                if (expanded) {
                    opts.classList.add('expanded');
                    btn.setAttribute('aria-expanded', 'true');
                } else {
                    opts.classList.remove('expanded');
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }
    
    // Sync mobile filters with desktop state
    function syncMobileFilters() {
        // Sync checkboxes
        document.querySelectorAll('#filter-section input[type=checkbox]').forEach(cb => {
            const mobileCb = mobileFilterContent.querySelector(`#mobile-filter-role input[value="${cb.value}"], #mobile-filter-type input[value="${cb.value}"]`);
            if (mobileCb) {
                mobileCb.checked = cb.checked;
            }
        });
        
        // Sync radio buttons
        document.querySelectorAll('#filter-section input[type=radio]:checked').forEach(radio => {
            const mobileRadio = mobileFilterContent.querySelector(`#mobile-filter-date input[value="${radio.value}"]`);
            if (mobileRadio) {
                mobileRadio.checked = true;
            }
        });
        
        // Sync date inputs
        const startDate = document.getElementById('start-date');
        const endDate = document.getElementById('end-date');
        const mobileStartDate = mobileFilterContent.querySelector('#mobile-start-date');
        const mobileEndDate = mobileFilterContent.querySelector('#mobile-end-date');
        
        if (startDate && mobileStartDate) {
            mobileStartDate.value = startDate.value;
        }
        if (endDate && mobileEndDate) {
            mobileEndDate.value = endDate.value;
        }
    }
    
    // Open mobile filter popup
    function openMobileFilters() {
        populateMobileFilters();
        syncMobileFilters();
        mobileFilterOverlay.classList.add('active');
        mobileFilterPopup.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // Close mobile filter popup
    function closeMobileFilters() {
        mobileFilterOverlay.classList.remove('active');
        mobileFilterPopup.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Event listeners
    mobileFiltersBtn.addEventListener('click', openMobileFilters);
    mobileFilterClose.addEventListener('click', closeMobileFilters);
    mobileFilterOverlay.addEventListener('click', closeMobileFilters);
    
    // Clear all filters
    mobileClearFilters.addEventListener('click', () => {
        document.getElementById('clear-filters').click();
        closeMobileFilters();
    });
    
    // Handle escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileFilterPopup.classList.contains('active')) {
            closeMobileFilters();
        }
    });
}

// Only trigger re-render on horizontal (width) resizes, not vertical
let resizeTimeout;
let prevWindowWidth = window.innerWidth;
window.addEventListener('resize', () => {
    const currentWidth = window.innerWidth;
    if (currentWidth !== prevWindowWidth) {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Re-render results if there's a layout change around 870px breakpoint
            if (allData.length > 0) {
                renderResults();
            }
        }, 250);
        prevWindowWidth = currentWidth;
    }
});