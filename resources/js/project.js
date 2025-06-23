import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.worker.min.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const viewer = document.getElementById('pdf-viewer');
  if (!viewer) return;
  const canvas = document.getElementById('pdf-canvas');
  const canvasContainer = document.getElementById('pdf-canvas-container');
  const ctx = canvas.getContext('2d');
  const url = viewer.dataset.pdf;
  let pdfDoc = null;
  let pageNum = 1;
  let zoom = 1;

  const pageNumInput = document.getElementById('pdf-page-num');
  const pageCountSpan = document.getElementById('pdf-page-count');
  const prevBtn = document.getElementById('pdf-prev');
  const nextBtn = document.getElementById('pdf-next');
  const zoomInBtn = document.getElementById('pdf-zoom-in');
  const zoomOutBtn = document.getElementById('pdf-zoom-out');
  const zoomSelect = document.getElementById('pdf-zoom-select');
  const downloadBtn = document.getElementById('pdf-download');
  const printBtn = document.getElementById('pdf-print');
  const sidebar = document.getElementById('pdf-sidebar');
  const sidebarToggle = document.getElementById('pdf-sidebar-toggle');
  const expandBtn = document.getElementById('pdf-expand');
  const frame = document.getElementById('frame');

  function renderPage(num) {
    pdfDoc.getPage(num).then(page => {
      const baseViewport = page.getViewport({ scale: 1 });
      const containerHeight = canvasContainer.clientHeight;
      const baseScale = containerHeight / baseViewport.height;
      const viewport = page.getViewport({ scale: baseScale * zoom });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      page.render({ canvasContext: ctx, viewport });
      pageNumInput.value = num;
      pageCountSpan.textContent = pdfDoc.numPages;
    });
  }

  pdfjsLib.getDocument(url).promise.then(pdf => {
    pdfDoc = pdf;
    pageCountSpan.textContent = pdfDoc.numPages;
    renderPage(pageNum);

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      pdfDoc.getPage(i).then(p => {
        const v = p.getViewport({ scale: 0.2 });
        const c = document.createElement('canvas');
        c.width = v.width;
        c.height = v.height;
        p.render({ canvasContext: c.getContext('2d'), viewport: v });
        c.classList.add('pdf-thumb');
        c.addEventListener('click', () => {
          pageNum = i;
          renderPage(pageNum);
        });
        sidebar.appendChild(c);
      });
    }
  }).catch(err => console.error('Failed to load PDF:', err));

  prevBtn.addEventListener('click', () => {
    if (pageNum <= 1) return;
    pageNum--;
    renderPage(pageNum);
  });

  nextBtn.addEventListener('click', () => {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    renderPage(pageNum);
  });

  pageNumInput.addEventListener('change', () => {
    const n = parseInt(pageNumInput.value, 10);
    if (!isNaN(n) && n >= 1 && n <= pdfDoc.numPages) {
      pageNum = n;
      renderPage(pageNum);
    } else {
      pageNumInput.value = pageNum;
    }
  });

  zoomInBtn.addEventListener('click', () => {
    zoom = Math.min(zoom + 0.25, 3);
    zoomSelect.value = zoom;
    renderPage(pageNum);
  });

  zoomOutBtn.addEventListener('click', () => {
    zoom = Math.max(zoom - 0.25, 0.5);
    zoomSelect.value = zoom;
    renderPage(pageNum);
  });

  zoomSelect.addEventListener('change', () => {
    zoom = parseFloat(zoomSelect.value);
    renderPage(pageNum);
  });

  downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    link.click();
  });

  printBtn.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
  });

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  expandBtn.addEventListener('click', () => {
    frame.classList.toggle('expanded');
    renderPage(pageNum);
  });
});