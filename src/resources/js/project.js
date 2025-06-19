import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.worker.min.mjs';

document.addEventListener('DOMContentLoaded', () => {
  // Breadcrumb setup
  const bc = document.getElementById('breadcrumbs');
  if (bc) {
    const ref = document.referrer;
    let label = 'Home';
    let url = '/';
    if (/\/explore/.test(ref)) { label = 'Explore'; url = '/explore'; }
    else if (/\/blog/.test(ref)) { label = 'Blog'; url = '/blog'; }
    else if (/\/about/.test(ref)) { label = 'About'; url = '/about'; }
    else if (/\/contact/.test(ref)) { label = 'Contact'; url = '/contact'; }
    bc.innerHTML = `<a href="${url}">Back to ${label}</a>`;
  }

  const canvas = document.getElementById('pdf-canvas');
  if (!canvas) return;
  const pdfUrl = canvas.dataset.pdf;
  if (!pdfUrl) return;
  const context = canvas.getContext('2d');

  pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
    return pdf.getPage(1).then(page => {
      const scale = 1;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      return page.render({ canvasContext: context, viewport }).promise;
    });
  }).catch(err => {
    console.error('Failed to load PDF:', err);
  });
});