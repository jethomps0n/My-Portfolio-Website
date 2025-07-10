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

// Video preview functions (simplified from original working version)
const previewStart = event => {
    const video = event.currentTarget.querySelector('.thumbnail.passive');
    if (video && video.checkVisibility({visibilityProperty: false})) {
        hoverTimeout = setTimeout(() => {
            video.currentTime = 0;
            video.play().catch(() => {}); // Handle play failures silently
        }, hoverDelay);
    }
};

const previewStop = event => {
    const video = event.currentTarget.querySelector('.thumbnail.passive');
    if (video) {
        clearTimeout(hoverTimeout);
        video.pause();
    }
};

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
    applyURL();
    loadData();
});

// Optimized event binding with passive listeners and debouncing
function bindEvents(){
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    
    // Debounced search for better INP
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchText = searchInput.value.trim().toLowerCase();
            clearSearch.style.display = searchText ? 'block' : 'none';
            currentPage = 1;
            update();
        }, 150); // 150ms debounce
    }, { passive: true });
    
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchText = '';
        clearSearch.style.display = 'none';
        currentPage = 1;
        update();
    });

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

    // Mobile filter toggle functionality
    setupMobileFilterToggle();
}

// Enhanced mobile filter toggle setup
function setupMobileFilterToggle() {
    const filterSection = document.getElementById('filter-section');
    const mobileToggle = document.getElementById('mobile-filter-toggle');
    const filterBadge = document.getElementById('filter-badge');
    
    // Check if we're in mobile view
    function isMobileView() {
        return window.innerWidth < 768;
    }
    
    // Update filter badge count
    function updateFilterBadge() {
        const activeFilters = selectedRoles.size + selectedTypes.size + (dateRange.start && dateRange.end ? 1 : 0) + (selectedDateRadio ? 1 : 0);
        if (filterBadge) {
            filterBadge.textContent = activeFilters > 0 ? activeFilters.toString() : '';
        }
    }
    
    // Initialize filter state based on screen size
    function initializeFilterState() {
        if (isMobileView()) {
            filterSection.classList.add('collapsed');
            if (mobileToggle) {
                mobileToggle.classList.remove('active');
                mobileToggle.setAttribute('aria-expanded', 'false');
            }
        } else {
            filterSection.classList.remove('collapsed');
            if (mobileToggle) {
                mobileToggle.classList.remove('active');
                mobileToggle.setAttribute('aria-expanded', 'false');
            }
        }
        updateFilterBadge();
    }
    
    // Handle mobile toggle click
    function handleMobileToggleClick() {
        if (!isMobileView()) return;
        
        const isCollapsed = filterSection.classList.contains('collapsed');
        
        if (isCollapsed) {
            filterSection.classList.remove('collapsed');
            mobileToggle.classList.add('active');
            mobileToggle.setAttribute('aria-expanded', 'true');
        } else {
            filterSection.classList.add('collapsed');
            mobileToggle.classList.remove('active');
            mobileToggle.setAttribute('aria-expanded', 'false');
        }
    }
    
    // Handle window resize
    function handleResize() {
        initializeFilterState();
    }
    
    // Add event listeners
    if (mobileToggle) {
        mobileToggle.addEventListener('click', handleMobileToggleClick);
    }
    
    window.addEventListener('resize', handleResize);
    
    // Listen for filter changes to update badge
    const filterInputs = document.querySelectorAll('#filter-section input[type="checkbox"], #filter-section input[type="radio"]');
    filterInputs.forEach(input => {
        input.addEventListener('change', updateFilterBadge);
    });
    
    // Listen for custom date changes
    const dateInputs = document.querySelectorAll('#start-date, #end-date');
    dateInputs.forEach(input => {
        input.addEventListener('change', updateFilterBadge);
    });
    
    // Initialize on page load
    initializeFilterState();
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
                
                // For items with Screenplay === "Sole", only create img element
                // For all others, create both img and video elements
                if (disablePreview) {
                    thumbDiv.innerHTML = `<img class="thumbnail active" src="${item.imgSrc}" alt="" loading="lazy">`;
                    a.classList.add('no-preview');
                } else {
                    thumbDiv.innerHTML = `<img class="thumbnail active" src="${item.imgSrc}" alt="" loading="lazy"><video class="thumbnail passive" src="${item.previewSrc}" muted loop preload="none"></video>`;
                }
                
                // Add video preview event listeners ONLY if preview is not disabled
                // Attach to the <a> element so hovering anywhere on the result item triggers preview
                if (!disablePreview) {
                    a.addEventListener('mouseenter', previewStart);
                    a.addEventListener('mouseleave', previewStop);
                }
                
                // Add screenplay/version badges if needed
                if (hasScreenplay) {
                    const badgeWrapper = document.createElement('div');
                    badgeWrapper.className = 'badge-wrapper';
                    badgeWrapper.style.cssText = `
                        position: absolute;
                        bottom: 8px;
                        right: 8px;
                        display: flex;
                        pointer-events: none;
                        z-index: 5;
                    `;
                    
                    // Create screenplay badge
                    const screenplayBadge = document.createElement('span');
                    screenplayBadge.className = 'screenplay-badge';
                    screenplayBadge.textContent = 'Screenplay Attached';
                    screenplayBadge.style.cssText = `
                        background: hsla(214, 100%, 45%, 1);
                        color: hsla(0, 0%, 100%, 1);
                        padding: 2px 8px;
                        border-radius: 8px;
                        font-size: 0.65rem;
                        white-space: nowrap;
                    `;
                    
                    // Add version badge if versioned
                    if (item.versioning === 'Yes' || item.versioning === 'Completed') {
                        const version = (item.versionInfo && item.versionInfo.currentVersion) ? item.versionInfo.currentVersion : 1;
                        
                        screenplayBadge.style.borderTopRightRadius = '0';
                        screenplayBadge.style.borderBottomRightRadius = '0';
                        
                        const versionBadge = document.createElement('span');
                        versionBadge.className = 'version-badge';
                        versionBadge.textContent = `v${version}`;
                        versionBadge.style.cssText = `
                            background: hsla(120, 60%, 45%, 1);
                            color: white;
                            padding: 2px 8px;
                            border-radius: 8px;
                            border-top-left-radius: 0;
                            border-bottom-left-radius: 0;
                            font-size: 0.65rem;
                            font-weight: 500;
                        `;
                        
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
                const h4 = document.createElement('h4');
                h4.textContent = item.title;
                info.appendChild(h4);
                const small = document.createElement('small');
                const roles = (item.role || '').split('/').map(s => s.trim()).filter(Boolean);
                roles.forEach(r => {
                    small.appendChild(makeRoleTag(r));
                });
                if (roles.length > 0) small.appendChild(document.createTextNode(' · '));
                small.appendChild(document.createTextNode(item.date));
                info.appendChild(small);
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
    next.addEventListener('click',()=>{
        if(currentPage<totalPages){
            currentPage++;
            renderResults();
            scrollToTop();
        }
    });
    pag.appendChild(next);
}