import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.worker.min.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const viewer = document.getElementById('pdf-viewer');
  if (!viewer) return;
  const pagesContainer = document.getElementById('pdf-pages');
  const canvasContainer = document.getElementById('pdf-canvas-container');
  const url = viewer.dataset.pdf;
  
  // Get the actual decoded filename from the URL
  const getDecodedFilename = (url) => {
    try {
      // Extract filename from URL and decode it
      const filename = url.split('/').pop();
      // First replace + with spaces, then decode URI components
      let decodedFilename = decodeURIComponent(filename.replace(/\+/g, ' '));
      
      // Replace quotes with a file-system-friendly alternative
      // Using single quotes or removing them entirely - you can choose your preference
      decodedFilename = decodedFilename.replace(/"/g, "'"); // Replace " with '
      // Alternative: decodedFilename = decodedFilename.replace(/"/g, ""); // Remove quotes entirely
      
      return decodedFilename;
    } catch (e) {
      // If decoding fails, fallback to original filename
      console.warn('Failed to decode filename:', e);
      return url.split('/').pop();
    }
  };
  let pdfDoc = null;
  let pageNum = 1;
  let zoom = 1;
  let currentZoom = 1;
  let zoomMode = 'custom';
  let oldZoom = zoom;
  let oldScrollLeft = 0;
  let oldScrollTop = 0;

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
      zoom = canvasContainer.clientHeight / base.height;
      currentZoom = zoom;
      return zoom;
    } else if (zoomMode === 'width') {
      zoom = canvasContainer.clientWidth / base.width;
      currentZoom = zoom;
      return zoom;
    } else if (zoomMode === 'auto') {
      zoom = 1.1;
      currentZoom = zoom;
      return zoom;
    }
    return zoom;
  }

  function renderPages(skipScrollToPage = false) {
    if (!pdfDoc) return;
    
    // Clear existing pages
    pagesContainer.innerHTML = '';
    
    // Track rendering completion
    let renderedPages = 0;
    const totalPages = pdfDoc.numPages;
    
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const canvas = document.createElement('canvas');
      canvas.dataset.page = i;
      canvas.classList.add('pdf-page');
      pagesContainer.appendChild(canvas);
      
      pdfDoc.getPage(i).then(page => {
        const base = page.getViewport({ scale: 1 });
        const scale = calculateScale(base);
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        
        // Render the page
        const renderContext = {
          canvasContext: canvas.getContext('2d'),
          viewport: viewport
        };
        
        page.render(renderContext).promise.then(() => {
          renderedPages++;
          if (renderedPages === totalPages && !skipScrollToPage) {
            // All pages rendered
            scrollToPage(pageNum);
          }
        });
      });
    }
    
    pageCountSpan.textContent = pdfDoc.numPages;
  }

  function repositionScroll() {
    requestAnimationFrame(() => {
      const scaleRatio = zoom / oldZoom;
      canvasContainer.scrollLeft = oldScrollLeft * scaleRatio;
      canvasContainer.scrollTop = oldScrollTop * scaleRatio;
    });
  }

  function scrollToPage(num) {
    const target = pagesContainer.querySelector(`canvas[data-page="${num}"]`);
    if (target) {
      canvasContainer.scrollTop = (target.height * (num - 1)) + (12 * (num - 1));
    }
    updatePageDisplay(num);
    scrollSidebarThumbIntoView(num);
  }

  function isElementInView(container, element) {
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    return (
      elementRect.top >= containerRect.top &&
      elementRect.bottom <= containerRect.bottom
    );
  }

  let sidebarScrollState = {
    scrollTop: 0,
    mode: 'restore'
  };

  function scrollSidebarThumbIntoView(pageNum) {
    const thumb = sidebar.querySelector(`.pdf-thumb[data-page="${pageNum}"]`)?.parentElement;
    if (!thumb) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    if (thumbRect.top < sidebarRect.top) {
      sidebar.scrollTop += thumbRect.top - sidebarRect.top;
    }
    else if (thumbRect.bottom > sidebarRect.bottom) {
      sidebar.scrollTop += thumbRect.bottom - sidebarRect.bottom;
    }
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
      scrollSidebarThumbIntoView(current);
    }
  }

  function renderSidebar() {
    sidebar.innerHTML = ''; // Clear existing thumbnails
    return Promise.all(
      Array.from({length: pdfDoc.numPages}, (_, i) => i + 1).map(i => 
        pdfDoc.getPage(i).then(p => {
          const v = p.getViewport({ scale: 0.2 });
          const thumbWrapper = document.createElement('div');
          thumbWrapper.classList.add('pdf-thumb-wrapper');
          const c = document.createElement('canvas');
          c.width = v.width;
          c.height = v.height;
          c.classList.add('pdf-thumb');
          c.dataset.page = i;
          if (i === pageNum) c.classList.add('active');
          c.addEventListener('click', () => scrollToPage(i));
          thumbWrapper.appendChild(c);
          const label = document.createElement('span');
          label.classList.add('pdf-thumb-label');
          label.textContent = i;
          thumbWrapper.appendChild(label);
          sidebar.appendChild(thumbWrapper);
          return p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
        })
      )
    );
  }

  canvasContainer.addEventListener('scroll', updateCurrentPage);

  pdfjsLib.getDocument(url).promise.then(pdf => {
    pdfDoc = pdf;
    pageCountSpan.textContent = pdfDoc.numPages;
    renderPages();
    renderSidebar();
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
    oldZoom = zoom;
    oldScrollLeft = canvasContainer.scrollLeft;
    oldScrollTop = canvasContainer.scrollTop;

    if (zoomMode !== 'custom') {
      zoom = Math.floor(currentZoom / 0.25) * 0.25;
      zoomMode = 'custom';
    }
    zoom = Math.min(zoom + 0.25, 3);
    zoomSelect.value = zoom;
    renderPages(true);
    repositionScroll();
  });

  zoomOutBtn.addEventListener('click', () => {
    oldZoom = zoom;
    oldScrollLeft = canvasContainer.scrollLeft;
    oldScrollTop = canvasContainer.scrollTop;
    if (zoomMode !== 'custom') {
      zoom = Math.ceil(currentZoom / 0.25) * 0.25;
      zoomMode = 'custom';
    }
    zoom = Math.max(zoom - 0.25, 0.25);
    zoomSelect.value = zoom;
    renderPages(true);
    repositionScroll();
  });

  zoomSelect.addEventListener('change', () => {
    oldZoom = zoom;
    oldScrollLeft = canvasContainer.scrollLeft;
    oldScrollTop = canvasContainer.scrollTop;
    const val = zoomSelect.value;
    if (val === 'fit' || val === 'width' || val === 'auto') {
      zoomMode = val;
    } else {
      zoomMode = 'custom';
      zoom = parseFloat(val);
      currentZoom = zoom;
    }
    renderPages(true);
    repositionScroll();
  });

  downloadBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      // Use decoded filename from URL
      link.download = getDecodedFilename(url);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Download failed', e);
    }
  });

  printBtn.addEventListener('click', async () => {
    try {
      // Fetch PDF from B2 and create blob URL to avoid cross-origin issues
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "100%";
      iframe.style.bottom = "100%";
      iframe.src = blobUrl;

      iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Clean up after a longer delay to allow print dialog interaction
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 600000); // 10 minutes
      };

      iframe.onerror = () => {
        console.error('Failed to load PDF in iframe');
        URL.revokeObjectURL(blobUrl);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      };

      document.body.appendChild(iframe);
    } catch (error) {
      console.error('Print failed:', error);
    }
  });

  sidebarToggle.addEventListener('click', () => {
    oldZoom = zoom;
    oldScrollLeft = canvasContainer.scrollLeft;
    oldScrollTop = canvasContainer.scrollTop;
    if (sidebar.classList.contains('open')) {
      const selectedThumb = sidebar.querySelector('.pdf-thumb.active')?.parentElement;
      if (selectedThumb) {
        if (isElementInView(sidebar, selectedThumb)) {
          sidebarScrollState.scrollTop = sidebar.scrollTop;
          sidebarScrollState.mode = 'restore';
        } else {
          sidebarScrollState.mode = 'focus';
        }
      }
    }
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
      sidebar.addEventListener(
        'transitionend',
        () => {
          const selectedThumb = sidebar.querySelector('.pdf-thumb.active')?.parentElement;
          if (selectedThumb) {
            if (sidebarScrollState.mode === 'restore') {
              sidebar.scrollTop = sidebarScrollState.scrollTop;
            } else if (sidebarScrollState.mode === 'focus') {
              sidebar.scrollTop = selectedThumb.offsetTop - selectedThumb.offsetHeight / 2;
            }
          }
          renderPages(true);
          repositionScroll();
        },
        { once: true }
      );
    } else {
      sidebar.addEventListener(
        'transitionend',
        () => {
          renderPages(true);
          repositionScroll();
        },
        { once: true }
      );
    }
  });

  expandBtn.addEventListener('click', () => {
      if (!modal) {
          // Store current frame state
          const frameState = {
              pageNum,
              zoom,
              zoomMode,
              scrollLeft: canvasContainer.scrollLeft,
              scrollTop: canvasContainer.scrollTop,
              sidebarOpen: sidebar.classList.contains('open')
          };

          // Create modal
          modal = document.createElement('div');
          modal.id = 'pdf-modal';
          
          // Clone frame and its contents
          const modalFrame = frame.cloneNode(true);
          modal.appendChild(modalFrame);
          document.body.appendChild(modal);
          document.body.classList.add('no-scroll');
          
          // Update expand button
          expandBtn.textContent = '✕';
          expandBtn.title = 'Close';

          // Get modal elements
          const modalViewer = modalFrame.querySelector('#pdf-viewer');
          const modalPagesContainer = modalFrame.querySelector('#pdf-pages');
          const modalCanvasContainer = modalFrame.querySelector('#pdf-canvas-container');
          const modalPageNumInput = modalFrame.querySelector('#pdf-page-num');
          const modalPageCountSpan = modalFrame.querySelector('#pdf-page-count');
          const modalPrevBtn = modalFrame.querySelector('#pdf-prev');
          const modalNextBtn = modalFrame.querySelector('#pdf-next');
          const modalZoomInBtn = modalFrame.querySelector('#pdf-zoom-in');
          const modalZoomOutBtn = modalFrame.querySelector('#pdf-zoom-out');
          const modalZoomSelect = modalFrame.querySelector('#pdf-zoom-select');
          const modalDownloadBtn = modalFrame.querySelector('#pdf-download');
          const modalPrintBtn = modalFrame.querySelector('#pdf-print');
          const modalSidebar = modalFrame.querySelector('#pdf-sidebar');
          const modalSidebarToggle = modalFrame.querySelector('#pdf-sidebar-toggle');

          // Track modal state
          let modalPageNum = frameState.pageNum;
          let modalZoom = frameState.zoom;
          let modalZoomMode = frameState.zoomMode;
          let modalOldZoom = frameState.zoom;
          let modalOldScrollLeft = frameState.scrollLeft;
          let modalOldScrollTop = frameState.scrollTop;
          let modalSidebarScrollState = null;

          function calculateModalZoom(base) {
            if (modalZoomMode === 'fit') {
                modalZoom = modalCanvasContainer.clientHeight / base.height;
                return modalZoom;
            } else if (modalZoomMode === 'width') {
                // Calculate available width accounting for sidebar
                const availableWidth = modalCanvasContainer.clientWidth;
                modalZoom = availableWidth / base.width;
                return modalZoom;
            } else if (modalZoomMode === 'auto') {
                modalZoom = 1.1;
                return modalZoom;
            }
            return modalZoom;
          }

          function renderModalPages(skipScrollToPage = false) {
            if (!pdfDoc) return;
            const currentPage = modalPageNum; // Store current page
            modalPagesContainer.innerHTML = '';
            
            const renderPromises = [];
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const canvas = document.createElement('canvas');
                canvas.dataset.page = i;
                canvas.classList.add('pdf-page');
                modalPagesContainer.appendChild(canvas);
                
                const renderPromise = pdfDoc.getPage(i).then(page => {
                    const base = page.getViewport({ scale: 1 });
                    const scale = calculateModalZoom(base);
                    const viewport = page.getViewport({ scale });
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.style.width = viewport.width + 'px';
                    canvas.style.height = viewport.height + 'px';
                    return page.render({
                        canvasContext: canvas.getContext('2d'),
                        viewport
                    }).promise;
                });
                renderPromises.push(renderPromise);
            }

            Promise.all(renderPromises).then(() => {
                if (!skipScrollToPage) {
                    // Restore scroll position for current page
                    const target = modalPagesContainer.querySelector(`canvas[data-page="${currentPage}"]`);
                    if (target) {
                        modalCanvasContainer.scrollTop = (target.height * (currentPage - 1)) + (12 * (currentPage - 1));
                    }
                }
                updateModalPageDisplay(currentPage);
            });
          }

          function repositionModalScroll() {
            requestAnimationFrame(() => {
              const scaleRatio = modalZoom / modalOldZoom;
              modalCanvasContainer.scrollLeft = modalOldScrollLeft * scaleRatio;
              modalCanvasContainer.scrollTop = modalOldScrollTop * scaleRatio;
            });
          }

          function updateModalPageDisplay(num) {
              modalPageNum = num;
              modalPageNumInput.value = num;
              modalSidebar.querySelectorAll('.pdf-thumb').forEach((t, idx) => {
                  t.classList.toggle('active', idx + 1 === num);
              });
              scrollModalSidebarThumbIntoView(num);
          }

          function scrollModalSidebarThumbIntoView(pageNum) {
              const thumb = modalSidebar.querySelector(`.pdf-thumb[data-page="${pageNum}"]`)?.parentElement;
              if (!thumb) return;
              
              // Center the thumbnail in the sidebar
              modalSidebar.scrollTop = thumb.offsetTop - 
                  (modalSidebar.clientHeight / 2) + (thumb.clientHeight / 2);
          }

          function scrollModalToPage(num) {
              const target = modalPagesContainer.querySelector(`canvas[data-page="${num}"]`);
              if (target) {
                  modalCanvasContainer.scrollTop = (target.height * (num - 1)) + (12 * (num - 1));
              }
              updateModalPageDisplay(num);
          }

          function updateModalCurrentPage() {
              const pages = modalPagesContainer.querySelectorAll('.pdf-page');
              let current = modalPageNum;
              for (const p of pages) {
                  if (p.offsetTop + p.clientHeight / 2 > modalCanvasContainer.scrollTop) {
                      current = parseInt(p.dataset.page, 10);
                      break;
                  }
              }
              if (current !== modalPageNum) {
                  updateModalPageDisplay(current);
              }
          }

          // Add scroll listener to modal
          modalCanvasContainer.addEventListener('scroll', () => {
              const pages = modalPagesContainer.querySelectorAll('.pdf-page');
              let currentVisible = modalPageNum;
              
              for (const page of pages) {
                  const pageNum = parseInt(page.dataset.page, 10);
                  const rect = page.getBoundingClientRect();
                  const containerRect = modalCanvasContainer.getBoundingClientRect();
                  
                  // Calculate how much of the page is visible
                  const visibleHeight = Math.min(rect.bottom, containerRect.bottom) - 
                                      Math.max(rect.top, containerRect.top);
                  const pageVisiblePercent = visibleHeight / rect.height;
                  
                  // If more than 50% of the page is visible, consider it the current page
                  if (pageVisiblePercent > 0.5) {
                      currentVisible = pageNum;
                      break;
                  }
              }
              
              if (currentVisible !== modalPageNum) {
                  updateModalPageDisplay(currentVisible);
              }
          });

          // Re-render PDF in modal
          if (pdfDoc) {
              modalPageCountSpan.textContent = pdfDoc.numPages;
              modalPageNumInput.value = modalPageNum;
              modalZoomSelect.value = modalZoom;
              
              // Set initial sidebar state
              if (frameState.sidebarOpen) {
                  modalSidebar.classList.add('open');
              }
              
              // Render pages
              renderModalPages();
              
              // Re-render sidebar thumbnails
              modalSidebar.innerHTML = '';
              for (let i = 1; i <= pdfDoc.numPages; i++) {
                  pdfDoc.getPage(i).then(p => {
                      const v = p.getViewport({ scale: 0.2 });
                      const thumbWrapper = document.createElement('div');
                      thumbWrapper.classList.add('pdf-thumb-wrapper');
                      const c = document.createElement('canvas');
                      c.width = v.width;
                      c.height = v.height;
                      c.classList.add('pdf-thumb');
                      c.dataset.page = i;
                      if (i === modalPageNum) c.classList.add('active');
                      c.addEventListener('click', () => {
                          scrollModalToPage(i);
                      });
                      thumbWrapper.appendChild(c);
                      const label = document.createElement('span');
                      label.classList.add('pdf-thumb-label');
                      label.textContent = i;
                      thumbWrapper.appendChild(label);
                      modalSidebar.appendChild(thumbWrapper);
                      p.render({ canvasContext: c.getContext('2d'), viewport: v });
                  });
              }

              // Attach event listeners to modal controls
              modalPrevBtn.addEventListener('click', () => {
                  if (modalPageNum > 1) {
                      scrollModalToPage(modalPageNum - 1);
                  }
              });

              modalNextBtn.addEventListener('click', () => {
                  if (modalPageNum < pdfDoc.numPages) {
                      scrollModalToPage(modalPageNum + 1);
                  }
              });

              modalPageNumInput.addEventListener('change', () => {
                  const n = parseInt(modalPageNumInput.value);
                  if (!isNaN(n) && n >= 1 && n <= pdfDoc.numPages) {
                      scrollModalToPage(n);
                  } else {
                      modalPageNumInput.value = modalPageNum;
                  }
              });

              modalZoomInBtn.addEventListener('click', () => {
                  modalOldZoom = modalZoom;
                  modalOldScrollLeft = modalCanvasContainer.scrollLeft;
                  modalOldScrollTop = modalCanvasContainer.scrollTop;

                  if (modalZoomMode !== 'custom') {
                      modalZoom = Math.floor(modalZoom / 0.25) * 0.25;
                      modalZoomMode = 'custom';
                  }
                  modalZoom = Math.min(modalZoom + 0.25, 3);
                  modalZoomSelect.value = modalZoom;
                  renderModalPages(true);
                  repositionModalScroll();
              });

              modalZoomOutBtn.addEventListener('click', () => {
                  modalOldZoom = modalZoom;
                  modalOldScrollLeft = modalCanvasContainer.scrollLeft;
                  modalOldScrollTop = modalCanvasContainer.scrollTop;

                  if (modalZoomMode !== 'custom') {
                      modalZoom = Math.ceil(modalZoom / 0.25) * 0.25;
                      modalZoomMode = 'custom';
                  }
                  modalZoom = Math.max(modalZoom - 0.25, 0.25);
                  modalZoomSelect.value = modalZoom;
                  renderModalPages(true);
                  repositionModalScroll();
              });

              modalZoomSelect.addEventListener('change', () => {
                  modalOldZoom = modalZoom;
                  modalOldScrollLeft = modalCanvasContainer.scrollLeft;
                  modalOldScrollTop = modalCanvasContainer.scrollTop;
                  
                  const val = modalZoomSelect.value;
                  modalZoomMode = (val === 'fit' || val === 'width' || val === 'auto') ? val : 'custom';
                  
                  pdfDoc.getPage(1).then(page => {
                      const base = page.getViewport({ scale: 1 });
                      if (val === 'fit' || val === 'width' || val === 'auto') {
                          modalZoom = calculateModalZoom(base);
                      } else {
                          modalZoom = parseFloat(val);
                      }
                      renderModalPages(true);
                      repositionModalScroll();
                  });
              });

              modalDownloadBtn.addEventListener('click', async () => {
                  try {
                      const res = await fetch(url);
                      const blob = await res.blob();
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      // Use decoded filename from URL
                      link.download = getDecodedFilename(url);
                      link.click();
                      URL.revokeObjectURL(link.href);
                  } catch (e) {
                      console.error('Download failed', e);
                  }
              });

              modalPrintBtn.addEventListener('click', async () => {
                  try {
                    // Fetch PDF from B2 and create blob URL to avoid cross-origin issues
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);

                    const iframe = document.createElement("iframe");
                    iframe.style.position = "fixed";
                    iframe.style.right = "100%";
                    iframe.style.bottom = "100%";
                    iframe.src = blobUrl;

                    iframe.onload = () => {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                      
                      // Clean up after a longer delay to allow print dialog interaction
                      setTimeout(() => {
                        URL.revokeObjectURL(blobUrl);
                        if (document.body.contains(iframe)) {
                          document.body.removeChild(iframe);
                        }
                      }, 600000); // 10 minutes
                    };

                    iframe.onerror = () => {
                      console.error('Failed to load PDF in iframe');
                      URL.revokeObjectURL(blobUrl);
                      if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                      }
                    };

                    document.body.appendChild(iframe);
                  } catch (error) {
                    console.error('Print failed:', error);
                  }
              });

              modalSidebarToggle.addEventListener('click', () => {
                  const currentPage = modalPageNum;
                  
                  // Store scroll state before toggle
                  if (modalSidebar.classList.contains('open')) {
                      const selectedThumb = modalSidebar.querySelector('.pdf-thumb.active')?.parentElement;
                      if (selectedThumb) {
                          if (isElementInView(modalSidebar, selectedThumb)) {
                              modalSidebarScrollState = {
                                  scrollTop: modalSidebar.scrollTop,
                                  mode: 'restore'
                              };
                          } else {
                              modalSidebarScrollState = {
                                  mode: 'focus'
                              };
                          }
                      }
                  }
                  
                  modalSidebar.classList.toggle('open');
                  
                  modalSidebar.addEventListener('transitionend', () => {
                      if (modalSidebar.classList.contains('open')) {
                          const selectedThumb = modalSidebar.querySelector('.pdf-thumb.active')?.parentElement;
                          if (selectedThumb) {
                              if (modalSidebarScrollState?.mode === 'restore') {
                                  modalSidebar.scrollTop = modalSidebarScrollState.scrollTop;
                              } else {
                                  modalSidebar.scrollTop = selectedThumb.offsetTop - 
                                      (modalSidebar.clientHeight / 2) + (selectedThumb.clientHeight / 2);
                              }
                          }
                      }
                      
                      if (modalZoomMode === 'width') {
                          pdfDoc.getPage(1).then(page => {
                              const base = page.getViewport({ scale: 1 });
                              modalZoom = calculateModalZoom(base);
                              renderModalPages();
                              scrollModalToPage(currentPage);
                          });
                      }
                  }, { once: true });
              });

              // Add resize handler for zoom modes
              window.addEventListener('resize', () => {
                  if (modal && modalZoomMode !== 'custom') {
                      const currentPage = modalPageNum; // Store current page
                      pdfDoc.getPage(1).then(page => {
                          const base = page.getViewport({ scale: 1 });
                          modalZoom = calculateModalZoom(base);
                          renderModalPages();
                          // Restore the current page after re-render
                          scrollModalToPage(currentPage);
                      });
                  }
              });
          }

          // Hook up modal's expand button
          const modalExpandBtn = modalFrame.querySelector('#pdf-expand');
          modalExpandBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12L4.81 17.775a1 1 0 1 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586z" stroke-width="1.5" stroke="#fff"/></svg>';
          modalExpandBtn.title = 'Close';
          modalExpandBtn.addEventListener('click', () => {
              // Store modal's final state
              const finalState = {
                  pageNum: modalPageNum,
                  zoom: modalZoom,
                  zoomMode: modalZoomMode,
                  sidebarOpen: modalSidebar.classList.contains('open'),
                  scrollLeft: modalCanvasContainer.scrollLeft,
                  scrollTop: modalCanvasContainer.scrollTop
              };

              // Close modal first
              modal.remove();
              modal = null;
              document.body.classList.remove('no-scroll');
              expandBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M9.79 12.79L4 18.59V17a1 1 0 0 0-2 0v4a1 1 0 0 0 .08.38a1 1 0 0 0 .54.54A1 1 0 0 0 3 22h4a1 1 0 0 0 0-2H5.41l5.8-5.79a1 1 0 0 0-1.42-1.42M21.92 2.62a1 1 0 0 0-.54-.54A1 1 0 0 0 21 2h-4a1 1 0 0 0 0 2h1.59l-5.8 5.79a1 1 0 0 0 0 1.42a1 1 0 0 0 1.42 0L20 5.41V7a1 1 0 0 0 2 0V3a1 1 0 0 0-.08-.38"/></svg>';
              expandBtn.title = 'Expand';

              // Update frame state
              pageNum = finalState.pageNum;
              zoom = finalState.zoom;
              zoomMode = finalState.zoomMode;
              
              // Update UI elements
              zoomSelect.value = modalZoomSelect.value;
              pageNumInput.value = finalState.pageNum;
              
              // Sync sidebar state
              if (finalState.sidebarOpen !== sidebar.classList.contains('open')) {
                  sidebar.classList.toggle('open');
              }

              // Re-render frame with new state
              pdfDoc.getPage(1).then(page => {
                  const base = page.getViewport({ scale: 1 });
                  if (zoomMode !== 'custom') {
                      zoom = calculateScale(base);
                  }
                  
                  // Complete re-render
                  renderPages();
                  
                  // After render, set correct page and scroll
                  Promise.resolve().then(() => {
                      scrollToPage(finalState.pageNum);
                      canvasContainer.scrollLeft = finalState.scrollLeft;
                      canvasContainer.scrollTop = finalState.scrollTop;
                      updatePageDisplay(finalState.pageNum);
                      scrollSidebarThumbIntoView(finalState.pageNum);
                  });
              });
          });
          
      } else {
          modal.remove();
          modal = null;
          document.body.classList.remove('no-scroll');
          expandBtn.textContent = '⤢';
          expandBtn.title = 'Expand';
      }
  });

  window.addEventListener('resize', renderPages);
});