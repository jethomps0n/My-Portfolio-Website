const itemsPerPage = 8;
let allData = [];
let filtered = [];
let currentPage = 1;
let selectedRoles = new Set();
let selectedTypes = new Set();
let dateRange = {start:null,end:null};
let searchText = '';
let sortMode = 'newest';

function parseDate(str){
    const d = new Date(str);
    return d;
}

function loadData(){
    fetch('/resources/json/data.json')
        .then(r=>r.json())
        .then(d=>{allData=d;update();});
}

document.addEventListener('DOMContentLoaded',()=>{
    bindEvents();
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
        more.style.display = more.style.display==='block'?'none':'block';
    });

    document.querySelectorAll('#filter-type input[type=checkbox]').forEach(cb=>{
        cb.addEventListener('change',()=>{
            if(cb.checked){selectedTypes.add(cb.value);}else{selectedTypes.delete(cb.value);}
            currentPage=1;update();
        });
    });
    document.querySelector('#filter-type .show-more').addEventListener('click',e=>{
        const more = document.querySelector('#filter-type .more');
        more.style.display = more.style.display==='block'?'none':'block';
    });

    document.querySelectorAll('#filter-date input[type=radio]').forEach(r=>{
        r.addEventListener('change',()=>{
            if(r.checked){
                const now = new Date();
                dateRange.end=now;
                dateRange.start=new Date(now.getTime()-parseInt(r.value)*24*60*60*1000);
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
            dateRange.start=new Date(s);
            dateRange.end=new Date(e);
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
            for(const val of selectedRoles){if(!r.includes(val)) return false;}
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
    if(selectedRoles.size>0){
        const div=document.createElement('div');
        div.textContent='ROLE: ';
        selectedRoles.forEach(val=>{div.appendChild(makeTag(val,'role'));count++;});
        container.appendChild(div);
    }
    if(selectedTypes.size>0){
        if(container.childNodes.length) container.appendChild(document.createTextNode(' '));
        const div=document.createElement('div');
        div.textContent='TYPE: ';
        selectedTypes.forEach(val=>{div.appendChild(makeTag(val,'type'));count++;});
        container.appendChild(div);
    }
    if(dateRange.start && dateRange.end){
        const div=document.createElement('div');
        div.textContent='DATE: ';
        div.appendChild(makeTag(`${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`,'date'));
        container.appendChild(div);
        count++;
    }
    document.getElementById('filter-count').textContent=count;
}

function makeTag(text,kind){
    const span=document.createElement('span');
    span.className='active-filter';
    span.textContent=text;
    const btn=document.createElement('button');
    btn.textContent='x';
    btn.addEventListener('click',()=>{
        if(kind==='role') selectedRoles.delete(text);
        if(kind==='type') selectedTypes.delete(text);
        if(kind==='date') dateRange={start:null,end:null};
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
    });
    document.getElementById('results-count').innerHTML=`Results <b>${startIndex+1}</b>-<b>${endIndex}</b> of <b>${total}</b>`;
    renderPagination(total);
}

function renderPagination(total){
    const pag=document.getElementById('pagination');
    pag.innerHTML='';
    const totalPages=Math.ceil(total/itemsPerPage)||1;
    const prev=document.createElement('button');
    prev.textContent='<';
    prev.disabled=currentPage===1;
    prev.addEventListener('click',()=>{if(currentPage>1){currentPage--;renderResults();}});
    pag.appendChild(prev);
    const start=Math.max(1,currentPage-1);
    const end=Math.min(totalPages,start+2);
    for(let i=start;i<=end;i++){
        const b=document.createElement('button');
        b.textContent=i;
        if(i===currentPage) b.disabled=true;
        b.addEventListener('click',()=>{currentPage=i;renderResults();});
        pag.appendChild(b);
    }
    const next=document.createElement('button');
    next.textContent='>';
    next.disabled=currentPage===totalPages;
    next.addEventListener('click',()=>{if(currentPage<totalPages){currentPage++;renderResults();}});
    pag.appendChild(next);
}