import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.worker.min.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const viewer = document.getElementById('pdf-viewer');
  if (!viewer) return;
  const pagesContainer = document.getElementById('pdf-pages');
  const canvasContainer = document.getElementById('pdf-canvas-container');
  const url = viewer.dataset.pdf;
  let pdfDoc = null;
  let pageNum = 1;
  let zoom = 1;
  let zoomMode = 'custom';

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
  let modal = null;
  const frameParent = frame.parentElement;
  const frameNextSibling = frame.nextElementSibling;

  function calculateScale(base) {
    if (zoomMode === 'fit') {
      // Scale so the page height fills the canvas container
      return canvasContainer.clientHeight / base.height;
    } else if (zoomMode === 'width') {
      // Scale so the page width fills the canvas container
      return canvasContainer.clientWidth / base.width;
    }
    return zoom;
  }

  function renderPages() {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      let canvas = pagesContainer.querySelector(`canvas[data-page="${i}"]`);
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.dataset.page = i;
        canvas.classList.add('pdf-page');
        pagesContainer.appendChild(canvas);
      }
      pdfDoc.getPage(i).then(page => {
        const base = page.getViewport({ scale: 1 });
        const scale = calculateScale(base);
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        page.render({ canvasContext: canvas.getContext('2d'), viewport });
      });
    }
    pageCountSpan.textContent = pdfDoc.numPages;
    scrollToPage(pageNum);
  }

  function scrollToPage(num) {
    const target = pagesContainer.querySelector(`canvas[data-page="${num}"]`);
    if (target) {
      canvasContainer.scrollTop = target.offsetTop;
    }
    updatePageDisplay(num);
  }

  function updatePageDisplay(num) {
    pageNum = num;
    pageNumInput.value = num;
    document.querySelectorAll('.pdf-thumb').forEach((t, idx) => {
      t.classList.toggle('active', idx + 1 === num);
    });
  }

  function updateCurrentPage() {
    const pages = pagesContainer.querySelectorAll('.pdf-page');
    let current = pageNum;
    for (const p of pages) {
      if (p.offsetTop + p.clientHeight / 2 > canvasContainer.scrollTop) {
        current = parseInt(p.dataset.page, 10);
        break;
      }
    }
    if (current !== pageNum) {
      updatePageDisplay(current);
    }
  }

  canvasContainer.addEventListener('scroll', updateCurrentPage);

  pdfjsLib.getDocument(url).promise.then(pdf => {
    pdfDoc = pdf;
    pageCountSpan.textContent = pdfDoc.numPages;
    renderPages();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      pdfDoc.getPage(i).then(p => {
        const v = p.getViewport({ scale: 0.2 });
        const c = document.createElement('canvas');
        c.width = v.width;
        c.height = v.height;
        p.render({ canvasContext: c.getContext('2d'), viewport: v });
        c.classList.add('pdf-thumb');
        c.dataset.page = i;
        if (i === pageNum) c.classList.add('active');
        c.addEventListener('click', () => {
          scrollToPage(i);
        });
        sidebar.appendChild(c);
      });
    }
  }).catch(err => console.error('Failed to load PDF:', err));

  prevBtn.addEventListener('click', () => {
    if (pageNum <= 1) return;
    scrollToPage(pageNum - 1);
  });

  nextBtn.addEventListener('click', () => {
    if (pageNum >= pdfDoc.numPages) return;
    scrollToPage(pageNum + 1);
  });

  pageNumInput.addEventListener('change', () => {
    const n = parseInt(pageNumInput.value, 10);
    if (!isNaN(n) && n >= 1 && n <= pdfDoc.numPages) {
      scrollToPage(n);
    } else {
      pageNumInput.value = pageNum;
    }
  });

  zoomInBtn.addEventListener('click', () => {
    if (zoomMode !== 'custom') {
      zoom = 1;
      zoomMode = 'custom';
    }
    zoom = Math.min(zoom + 0.25, 3);
    zoomSelect.value = zoom;
    renderPages();
  });

  zoomOutBtn.addEventListener('click', () => {
    if (zoomMode !== 'custom') {
      zoom = 1;
      zoomMode = 'custom';
    }
    zoom = Math.max(zoom - 0.25, 0.5);
    zoomSelect.value = zoom;
    renderPages();
  });

  zoomSelect.addEventListener('change', () => {
    const val = zoomSelect.value;
    if (val === 'fit' || val === 'width') {
      zoomMode = val;
    } else {
      zoomMode = 'custom';
      zoom = parseFloat(val);
    }
    renderPages();
  });

  downloadBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = url.split('/').pop();
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Download failed', e);
    }
  });

  printBtn.addEventListener('click', async () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      iframe.src = URL.createObjectURL(blob);
      iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        URL.revokeObjectURL(iframe.src);
        document.body.removeChild(iframe);
      };
    } catch (e) {
      console.error('Print failed', e);
    }
  });

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    renderPages();
  });

  expandBtn.addEventListener('click', () => {
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pdf-modal';
      modal.appendChild(frame);
      document.body.appendChild(modal);
      document.body.classList.add('no-scroll');
      expandBtn.textContent = '✕';
      expandBtn.title = 'Close';
    } else {
      if (frameNextSibling) {
        frameParent.insertBefore(frame, frameNextSibling);
      } else {
        frameParent.appendChild(frame);
      }
      modal.remove();
      modal = null;
      document.body.classList.remove('no-scroll');
      expandBtn.textContent = '⤢';
      expandBtn.title = 'Expand';
    }
    renderPages();
  });

  window.addEventListener('resize', renderPages);
});