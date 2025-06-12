const itemsPerPage = 5;
let allData = [];
let filtered = [];
let currentPage = 1;
let selectedRoles = new Set();
const knownRoles = ['Writer','Editor','Director','Producer','DP','Camera Operator','Production Assistant','Sound Recordist'];
let selectedTypes = new Set();
let dateRange = {start:null,end:null};
let selectedDateRadio = null;
let searchText = '';
let sortMode = 'newest';

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

    document.querySelectorAll('#filter-role input[type=checkbox]').forEach(cb=>{
        cb.addEventListener('change',()=>{
            if(cb.checked){selectedRoles.add(cb.value);}else{selectedRoles.delete(cb.value);}
            currentPage=1;update();
        });
    });
    document.querySelector('#filter-role .show-more').addEventListener('click',e=>{
        const more = document.querySelector('#filter-role .more');
        const btn = e.currentTarget;
        const expanded = more.style.display==='flex';
        more.style.display = expanded?'none':'flex';
        btn.innerHTML = expanded ? '<span class="text">Show More</span> <span class="arrow">▼</span>' : '<span class="text">Show Less</span> <span class="arrow">▲</span>';
    });

    document.querySelectorAll('#filter-type input[type=checkbox]').forEach(cb=>{
        cb.addEventListener('change',()=>{
            if(cb.checked){selectedTypes.add(cb.value);}else{selectedTypes.delete(cb.value);}
            currentPage=1;update();
        });
    });
    document.querySelector('#filter-type .show-more').addEventListener('click',e=>{
        const more = document.querySelector('#filter-type .more');
        const btn = e.currentTarget;
        const expanded = more.style.display==='flex';
        more.style.display = expanded?'none':'flex';
        btn.innerHTML = expanded ? '<span class="text">Show More</span> <span class="arrow">▼</span>' : '<span class="text">Show Less</span> <span class="arrow">▲</span>';
    });

    document.querySelectorAll('.filter-group .toggle').forEach(btn=>{
        btn.addEventListener('click',()=>{
            const group=btn.closest('.filter-group');
            const opts=group.querySelector('.options');
            const hidden=opts.style.display==='none';
            opts.style.display=hidden?'':'none';
            btn.textContent=hidden?'-':'+';
            btn.setAttribute('aria-expanded', hidden ? 'true' : 'false');
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
    ['start-date','end-date'].forEach(id=>{
        const input=document.getElementById(id);
        input.addEventListener('click',()=>{ if(input.showPicker) input.showPicker(); });
    });
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
            let match=false;
            if(selectedRoles.has('Miscellaneous')){
                const misc = knownRoles.every(role=>!r.includes(role));
                if(misc) match=true;
            }
            for(const val of selectedRoles){
                if(val==='Miscellaneous') continue;
                if(r.includes(val)){ match=true; break; }
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

function renderResults(){
    const results=document.getElementById('results-list');
    results.innerHTML='';
    const total=filtered.length;
    const startIndex=(currentPage-1)*itemsPerPage;
    const endIndex=Math.min(startIndex+itemsPerPage,total);
    const slice=filtered.slice(startIndex,endIndex);
    slice.forEach(item=>{
        const div=document.createElement('div');
        div.className='result-item';
        div.innerHTML=`<img src="${item.imgSrc}" alt="">`+
            `<div class="result-info"><h4>${item.title}</h4>`+
            `<small>${item.role} · ${item.date}</small><p>${item.description||''}</p></div>`;
        results.appendChild(div);
        const info=div.querySelector('.result-info');
        const p=info.querySelector('p');
        p.dataset.fulltext=p.textContent;
    });
    applyTruncation();
    document.getElementById('results-count').innerHTML=`Results <b>${startIndex+1}</b>-<b>${endIndex}</b> of <b>${total}</b>`;
    renderPagination(total);
    updateURL();
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

function truncateDescription(info){
    const p = info.querySelector('p');
    const allowed = parseInt(getComputedStyle(info).maxHeight) || info.clientHeight;
    const spaceAbove = p.offsetTop - info.offsetTop;
    const maxPHeight = allowed - spaceAbove;
    let text = p.textContent.trim();
    p.textContent = text;
    if(p.scrollHeight <= maxPHeight) return;
    while(text.length > 0 && p.scrollHeight > maxPHeight){
        text = text.slice(0, -1).trimEnd();
        p.textContent = text + '...';
    }
}

function applyTruncation(){
    document.querySelectorAll('.result-info').forEach(info=>{
        const p=info.querySelector('p');
        const full=p.dataset.fulltext||p.textContent;
        p.dataset.fulltext=full;
        p.textContent=full;
        truncateDescription(info);
    });
}

let truncateThrottle;
window.addEventListener('resize',()=>{
    clearTimeout(truncateThrottle);
    truncateThrottle=setTimeout(applyTruncation,150);
});

if(window.visualViewport){
    window.visualViewport.addEventListener('resize',()=>{
        clearTimeout(truncateThrottle);
        truncateThrottle=setTimeout(applyTruncation,150);
    });
}