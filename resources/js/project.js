import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.worker.min.mjs';

// Get the PDF URL from the canvas element
const pdfUrl = document.getElementById('pdf-canvas').dataset.pdf;
if (!pdfUrl) {
  console.error('PDF URL not defined.');
}

// Canvas setup
const canvas = document.getElementById('pdf-canvas');
const context = canvas.getContext('2d');

// Load and render the PDF
pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
  return pdf.getPage(1).then(page => {
    const scale = 1;
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    return page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
  });
}).catch(err => {
  console.error('Failed to load PDF:', err);
});
