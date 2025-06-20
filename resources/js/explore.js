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

const previewStart = event => {
    const video = event.currentTarget.querySelector('.thumbnail.passive');
    if (video && video.checkVisibility({visibilityProperty: false})) {
        hoverTimeout = setTimeout(() => {
            video.currentTime = 0;
            video.play();
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

function loadData(){
    fetch('/resources/json/data.json')
        .then(r => r.json())
        .then(d => { allData = d; update(); })
        .catch(err => {
            console.error('Failed to load data.json', err);
        });
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
    const params=new URLSearchParams();
    if(searchText) params.set('q',searchText);
    if(selectedRoles.size>0) params.set('roles',Array.from(selectedRoles).join(','));
    if(selectedTypes.size>0) params.set('types',Array.from(selectedTypes).join(','));
    if(dateRange.start&&dateRange.end){
        params.set('start',dateRange.start.toISOString().split('T')[0]);
        params.set('end',dateRange.end.toISOString().split('T')[0]);
    }
    if(sortMode!=='newest') params.set('sort',sortMode);
    if(currentPage>1) params.set('page',currentPage);
    const newUrl=location.pathname+(params.toString()?`?${params.toString()}`:'');
    history.replaceState(null,'',newUrl);
}

document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.pop-in').forEach(el=>{
        el.addEventListener('animationend',()=>el.classList.remove('pop-in'),{once:true});
    });
    document.querySelectorAll('.filter-group .options').forEach(o=>{
        o.classList.add('expanded');
        o.style.maxHeight = o.scrollHeight + 'px';
    });
    bindEvents();
    applyURL();
    loadData();
});

function bindEvents(){
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    searchInput.addEventListener('input',()=>{
        searchText = searchInput.value.trim().toLowerCase();
        clearSearch.style.display = searchText? 'block':'none';
        currentPage=1;update();
    });
    clearSearch.addEventListener('click',()=>{
        searchInput.value='';
        searchText='';
        clearSearch.style.display='none';
        currentPage=1;update();
    });

    searchInput.addEventListener('focus',()=>{
        document.body.classList.add('input-focus');
        if(typeof cursor!=='undefined' && cursor.hide){cursor.hide();}
    });
    searchInput.addEventListener('blur',()=>{
        document.body.classList.remove('input-focus');
        if(typeof cursor!=='undefined' && cursor.show){cursor.show();}
    });

    document.querySelectorAll('#filter-role input[type=checkbox]').forEach(cb=>{
        cb.addEventListener('change',()=>{
            if(cb.checked){selectedRoles.add(cb.value);}else{selectedRoles.delete(cb.value);}
            currentPage=1;update();
        });
    });
    
    function setupShowMore(id){
        const group=document.getElementById(id);
        const btn=group.querySelector('.show-more');
        const more=group.querySelector('.more');
        const opts=group.querySelector('.options');
        btn.addEventListener('click',()=>{
            const expanding=!more.classList.contains('expanded');
            btn.classList.toggle('expanded', expanding);
            if(expanding){
                more.classList.add('expanded');
                btn.querySelector('.text').textContent='Show Less';
            }else{
                more.classList.remove('expanded');
                btn.querySelector('.text').textContent='Show More';
            }
            requestAnimationFrame(()=>{
                opts.style.maxHeight='300px';
            });
        });
    }
    setupShowMore('filter-role');

    document.querySelectorAll('#filter-type input[type=checkbox]').forEach(cb=>{
        cb.addEventListener('change',()=>{
            if(cb.checked){selectedTypes.add(cb.value);}else{selectedTypes.delete(cb.value);}
            currentPage=1;update();
        });
    });
    setupShowMore('filter-type');

    document.querySelectorAll('.filter-group .toggle').forEach(btn=>{
        btn.addEventListener('click',()=>{
            const group=btn.closest('.filter-group');
            const opts=group.querySelector('.options');
            const expanded=btn.classList.toggle('open');
            if(expanded){
                opts.classList.add('expanded');
                opts.style.maxHeight=opts.scrollHeight+'px';
                btn.setAttribute('aria-expanded','true');
            }else{
                opts.style.maxHeight=opts.scrollHeight+'px';
                requestAnimationFrame(()=>{opts.classList.remove('expanded');opts.style.maxHeight='0';});
                btn.setAttribute('aria-expanded','false');
            }
        });
    });

    document.querySelectorAll('#filter-date input[type=radio]').forEach(r=>{
        r.addEventListener('click',()=>{
            if(selectedDateRadio===r){
                r.checked=false;
                selectedDateRadio=null;
                dateRange={start:null,end:null};
                update();
            }else{
                selectedDateRadio=r;
            }
        });
        r.addEventListener('change',()=>{
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

function update(){
    filtered = allData.filter(item=>{
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
    sortData();
    renderFilters();
    renderResults();
    updateURL();
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

function renderResults(){
    const results=document.getElementById('results-list');
    results.innerHTML='';
    const total=filtered.length;
    const startIndex=(currentPage-1)*itemsPerPage;
    const endIndex=Math.min(startIndex+itemsPerPage,total);
    const slice=filtered.slice(startIndex,endIndex);
    slice.forEach(item=>{
        const div=document.createElement('div');
        div.className='result-item ' + (firstRender ? 'pop-in' : 'fade-in');
        const a=document.createElement('a');
        a.href=`/explore/${item.slug}`||'#';
        const hasScreenplay = item.Screenplay === 'Yes' || item.Screenplay === 'Sole';
        const thumbClass = hasScreenplay ? 'thumb screenplay-attached' : 'thumb';
        const disablePreview = item.Screenplay === 'Sole';
        if (disablePreview) a.classList.add('no-preview');
        a.innerHTML=`<div class="${thumbClass}"><img class="thumbnail active" src="${item.imgSrc}" alt=""><video class="thumbnail passive" src="${item.videoSrc}" muted loop></video></div>`;

        const info=document.createElement('div');
        info.className='result-info';
        const h4=document.createElement('h4');
        h4.textContent=item.title;
        info.appendChild(h4);
        const small=document.createElement('small');
        const roles=(item.role||'').split('/').map(s=>s.trim()).filter(Boolean);
        roles.forEach(r=>{
            small.appendChild(makeRoleTag(r));
        });
        if(roles.length>0) small.appendChild(document.createTextNode(' · '));
        small.appendChild(document.createTextNode(item.date));
        info.appendChild(small);
        const p=document.createElement('p');
        p.textContent=item.description||'';
        info.appendChild(p);
        a.appendChild(info);

        if(!disablePreview){
            a.addEventListener('mouseenter', previewStart);
            a.addEventListener('mouseleave', previewStop);
        }
        div.appendChild(a);
        div.addEventListener('animationend',()=>{div.classList.remove('pop-in');div.classList.remove('fade-in');},{once:true});
        results.appendChild(div);
    });
    document.getElementById('results-count').innerHTML=`Results <b>${startIndex+1}</b>-<b>${endIndex}</b> of <b>${total}</b>`;
    renderPagination(total);
    updateURL();
    firstRender=false;
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
    const start=Math.max(1,currentPage-1);
    const end=Math.min(totalPages,start+2);
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