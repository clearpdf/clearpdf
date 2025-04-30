let pdfJsDoc = null;

// ReorderTool module using only pdf-lib
const ReorderTool = (() => {
  // Dependencies
  const { ipcRenderer } = require('electron');
  const fs = require('fs').promises;
  const path = require('path');
  const { PDFDocument } = require('pdf-lib');
  const Sortable = require('sortablejs');
  
  // Private variables
  let isActive = false;
  let pdfBytes = null;
  let currentPdfPath = null;
  let currentPageOrder = [];
  let sidebarElement;
  let thumbnailsContainer;
  let toolsPanel;
  let reorderContainer;
  let pagesContainer;
  
  // Initialize the module
  function init(config = {}) {
    console.log('Initializing ReorderTool');
    console.log('Initializing ReorderTool');
  
    // Store references to DOM elements
    sidebarElement = config.sidebarElement || document.querySelector('.sidebar');
    thumbnailsContainer = config.thumbnailsContainer || document.querySelector('#thumbnails-container');
    toolsPanel = config.toolsPanel || document.querySelector('.tools-panel');
    
    console.log('ReorderTool initialized with:', { 
      sidebarElement, 
      thumbnailsContainer, 
      toolsPanel 
    });
    
    // Create the reorder tool button if it doesn't exist
    createReorderToolButton();
    
    // Set up event listeners
    setupEventListeners();
    
    // Remove this line that's causing the error
    // createPageNavigationControls(pdfDoc);
  }
  
  function setupEventListeners() {
    // Find the reorder button in the existing UI
    const reorderButton = document.getElementById('reorder-tool');
    
    if (reorderButton) {
      reorderButton.addEventListener('click', () => {
        if (isActive) {
          deactivateReorderMode();
        } else {
          activateReorderMode();
        }
      });
      console.log('Added click listener to reorder button');
    } else {
      console.warn('Reorder tool button not found');
    }
  }
  
  // Function to create the button
  function createReorderToolButton() {
    // Check if button already exists
    if (document.getElementById('reorder-tool')) {
      return;
    }
    
    // Create button if tools panel exists
    if (toolsPanel) {
      const reorderToolBtn = document.createElement('button');
      reorderToolBtn.id = 'reorder-tool';
      reorderToolBtn.className = 'tool-button';
      reorderToolBtn.innerHTML = '<span class="icon">🔄</span>Reorder Pages';
      toolsPanel.appendChild(reorderToolBtn);
      console.log('Reorder tool button created');
    } else {
      console.warn('Tools panel not found, cannot create reorder button');
    }
  }
  
  // Function to activate reorder mode
  async function activateReorderMode() {
    if (isActive) return;

    console.log('Activating reorder mode');
    isActive = true;
    
    try {
      // Show loading overlay while getting PDF data
      showLoadingOverlay('Preparing reorder mode...');
      
       
      // Clear previous PDF data
      pdfBytes = null;
      currentPdfPath = null;
      currentPageOrder = [];
      pdfJsDoc = null;

      // Get the current PDF data
      let pdfData = await getCurrentPdf();
      
      // If no PDF data, show confirmation dialog
      if (!pdfData) {
        console.log('No PDF loaded, showing confirmation dialog');
        hideLoadingOverlay();
        isActive = false;
        
        // Check if we can see a PDF in the viewer
        const pdfViewerElement = document.querySelector('#pdf-viewer');
        if (pdfViewerElement && pdfViewerElement.style.display !== 'none') {
          // There seems to be a PDF loaded but we couldn't get the data
          showWarningMessage('A PDF appears to be loaded but the data couldn\'t be accessed. Please try reopening the file.');
          return;
        }
        
        const confirmOpen = confirm('No PDF is currently loaded. Do you want to open a file?');
        if (confirmOpen) {
          // Find and click the upload button
          const uploadButton = document.getElementById('upload-button');
          if (uploadButton) {
            uploadButton.click();
            
            // Wait for file to be opened
            pdfData = await new Promise(resolve => {
              ipcRenderer.once('pdf-opened', (_, data) => {
                // Store in global storage
                window.pdfManagerData = window.pdfManagerData || {};
                window.pdfManagerData.currentPdfBuffer = data.buffer;
                window.pdfManagerData.currentPdfPath = data.filePath;
                
                resolve({
                  buffer: data.buffer,
                  filePath: data.filePath
                });
              });
              
              // Timeout after 30 seconds
              setTimeout(() => resolve(null), 30000);
            });
            
            // If we got PDF data, wait 2s then re-trigger reorder mode
            if (pdfData) {
              setTimeout(() => {
                const reorderButton = document.getElementById('reorder-tool');
                if (reorderButton) reorderButton.click();
              }, 2000);
              return;
            } else {
              return; // Exit if no file was selected
            }
          } else {
            console.error('Upload button not found');
            return;
          }
        } else {
          return; // User declined to open a file
        }
      }
      
      // Continue with existing code...
      pdfBytes = pdfData.buffer;
      currentPdfPath = pdfData.filePath;
      
      console.log('PDF data obtained successfully:', {
        bufferSize: pdfBytes ? pdfBytes.length : 'null',
        path: currentPdfPath
      });
      
      // Create and show UI for reordering
      createReorderUI();

      pdfJsDoc = null;
      currentPageOrder = [];
      
      // Ensure reorderContainer is properly initialized
      if (!reorderContainer) {
        console.error('Reorder container not initialized');
        showErrorDialog('Error', 'Failed to initialize reorder interface');
        isActive = false;
        return;
      }
      
      // Load PDF pages for reordering
      await renderPdfPagesForReordering(pdfBytes);
      
      // Enable drag and drop for pages
      enableDraggablePages();
      
      // Initialize PDF viewer if loading directly from reorder mode
      if (!window.pdfDoc) {
        const pdfUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
        pdfjsLib.getDocument(pdfUrl).promise.then(pdfDoc => {
          window.pdfDoc = pdfDoc;
          // Use the renderPage function from renderer.js through window object
          if (window.renderPage) {
            window.renderPage(1);
          }
          if (window.renderThumbnails) {
            window.renderThumbnails();
          }
        });
      }
      
      // Add the reorder container to the app while preserving existing content
      const appElement = document.getElementById('app');
      if (appElement && reorderContainer) {
        // Store existing content
        const existingContent = Array.from(appElement.children);
        
        // Clear app element
        appElement.innerHTML = '';
        
        // Create a container for the existing content
        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';
        mainContent.style.display = 'flex';
        mainContent.style.flexDirection = 'row';
        mainContent.style.flex = '1';
        
        // Restore existing content
        existingContent.forEach(child => mainContent.appendChild(child));
        
        // Add both containers to app
        appElement.appendChild(mainContent);
        appElement.appendChild(reorderContainer);
      }

      const navControls = document.querySelector('.page-navigation-controls');
      if (navControls) {
        navControls.style.display = 'flex';
      } else {
        // If not created yet, create them
        // createPageNavigationControls(pdfJsDoc);
      }

      if (window.pdfDoc && window.pdfDoc.numPages > 30) {
        addPageNavigationControls(window.pdfDoc.numPages);
      }

      if (pdfJsDoc) {
        const pageCount = pdfJsDoc.getPageCount();
        currentPageOrder = Array.from({ length: pageCount }, (_, i) => i);
      } else if (window.pdfDoc) {
        const pageCount = window.pdfDoc.numPages;
        currentPageOrder = Array.from({ length: pageCount }, (_, i) => i);
      } else {
        console.warn('No PDF document available to initialize page order');
        currentPageOrder = [];
      }

  // Load the most recent PDF for reordering
  loadPdfForReordering();

    } catch (error) {
      console.error('Error activating reorder mode:', error);
      showErrorDialog('Error', 'Failed to activate reorder mode: ' + error.message);
      isActive = false;
    }
  }


  async function loadPdfForReordering() {
    try {
      console.log('Loading PDF for reordering');
      
      // Request the current PDF info from the main process
      ipcRenderer.send('get-current-pdf-info');
      
      // Wait for the response
      const pdfInfo = await new Promise((resolve) => {
        ipcRenderer.once('current-pdf-info', (_, data) => {
          resolve(data);
        });
        
        // Add timeout
        setTimeout(() => resolve(null), 5000);
      });
      
      if (pdfInfo && pdfInfo.buffer) {
        console.log('Received current PDF data for reordering');
        // Render the PDF pages for reordering
        await renderPdfPagesForReordering(pdfInfo.buffer);
      } else {
        console.log('No PDF data available for reordering');
        // Show a message to the user
        const messageElement = document.createElement('div');
        messageElement.textContent = 'No PDF loaded. Please load a PDF first.';
        messageElement.style.color = 'white';
        messageElement.style.textAlign = 'center';
        messageElement.style.padding = '20px';
        messageElement.style.fontSize = '18px';
        
        if (pagesContainer) {
          pagesContainer.innerHTML = '';
          pagesContainer.appendChild(messageElement);
        }
      }
    } catch (error) {
      console.error('Error loading PDF for reordering:', error);
    }
  }


  
  // Function to deactivate reorder mode
  // function deactivateReorderMode() {
  //   if (!isActive) return;
    
  //   console.log('Deactivating reorder mode');
    
  //   // Remove the reorder UI
  //   if (reorderContainer && reorderContainer.parentNode) {
  //     reorderContainer.parentNode.removeChild(reorderContainer);
  //   }
    
  //   isActive = false;
  //   pdfBytes = null;
  //   currentPageOrder = [];

  //   const navControls = document.querySelector('.page-navigation-controls');
  //   if (navControls) {
  //     navControls.style.display = 'none';
  //   }
  // }

    // Function to deactivate reorder mode
    function deactivateReorderMode() {
      if (!isActive) return;
      
      console.log('Deactivating reorder mode');
      
      // Remove the reorder UI
      if (reorderContainer && reorderContainer.parentNode) {
        reorderContainer.parentNode.removeChild(reorderContainer);
      }
      
      isActive = false;
      
      // Don't clear pdfBytes here, just reset the page order
      // pdfBytes = null;  // <-- Remove or comment this line
      currentPageOrder = [];
  
      const navControls = document.querySelector('.page-navigation-controls');
      if (navControls) {
        navControls.style.display = 'none';
      }
    }
  
  // Function to create reorder UI
  function createReorderUI() {
    // Create the main container for reordering UI
    reorderContainer = document.createElement('div');
    reorderContainer.className = 'reorder-container';
    reorderContainer.style.position = 'fixed';
    reorderContainer.style.top = '0';
    reorderContainer.style.left = '0';
    reorderContainer.style.width = '100%';
    reorderContainer.style.height = '100%';
    reorderContainer.style.backgroundColor = '#1a1a1a';
    reorderContainer.style.zIndex = '1000';
    reorderContainer.style.display = 'flex';
    reorderContainer.style.flexDirection = 'column';
  
    // Create preview section (70% height)
    const previewSection = document.createElement('div');
    previewSection.className = 'reorder-preview-section';
    previewSection.style.height = '70%';
    previewSection.style.width = '100%';
    previewSection.style.display = 'flex';
    previewSection.style.justifyContent = 'center';
    previewSection.style.alignItems = 'center';
    previewSection.style.backgroundColor = '#2a2a2a';
    previewSection.style.padding = '20px';
    previewSection.style.position = 'relative';
    previewSection.style.overflow = 'hidden';

    // Create preview canvas container for better scaling
    const previewCanvasContainer = document.createElement('div');
    // previewCanvasContainer.style.width = '100%';
    // previewCanvasContainer.style.height = '100%';
    previewCanvasContainer.style.display = 'flex';
    previewCanvasContainer.style.justifyContent = 'center';
    previewCanvasContainer.style.alignItems = 'center';

    // Create preview canvas
    const previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'preview-canvas';
    previewCanvas.style.maxWidth = '100%';
    previewCanvas.style.maxHeight = '100%';
    previewCanvas.style.width = 'auto';
    previewCanvas.style.height = 'auto';
    previewCanvas.style.objectFit = 'contain';
    previewCanvasContainer.appendChild(previewCanvas);
    previewSection.appendChild(previewCanvasContainer);
    previewSection.appendChild(previewCanvas);
  
    // Create pages container (20% height)
    pagesContainer = document.createElement('div');
    pagesContainer.className = 'pdf-pages-container';
    pagesContainer.style.height = '30%';
    pagesContainer.style.width = '100%';
    pagesContainer.style.backgroundColor = '#333';
    pagesContainer.style.overflowX = 'auto';
    pagesContainer.style.overflowY = 'hidden';
    pagesContainer.style.whiteSpace = 'nowrap';
    pagesContainer.style.WebkitOverflowScrolling = 'touch';
    pagesContainer.style.padding = '10px';
    pagesContainer.style.boxSizing = 'border-box';
    pagesContainer.style.display = 'flex';
    pagesContainer.style.flexDirection = 'row';
    pagesContainer.style.justifyContent = 'center';
    pagesContainer.style.alignItems = 'center';
    pagesContainer.style.gap = '10px';

    Object.assign(pagesContainer.style, {
      height: '30%',
      width: '100%',
      backgroundColor: '#333',
      overflowX: 'auto',
      overflowY: 'hidden',
      whiteSpace: 'nowrap',
      padding: '10px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start', // Changed from center to flex-start
      alignItems: 'flex-start',     // Changed from center to flex-start
      gap: '10px',
      scrollBehavior: 'smooth',
      position: 'relative',
      minHeight: '200px'
    });

  
  
    // Create controls overlay
    const controlsOverlay = document.createElement('div');
    controlsOverlay.style.position = 'absolute';
    controlsOverlay.style.top = '10px';
    controlsOverlay.style.right = '10px';
    controlsOverlay.style.display = 'flex';
    controlsOverlay.style.gap = '10px';
    controlsOverlay.style.zIndex = '1';
  
    const closeButton = document.createElement('button');
    closeButton.className = 'close-reorder-mode';
    closeButton.innerHTML = '&times;';
    closeButton.style.background = 'rgba(0, 0, 0, 0.5)';
    closeButton.style.border = 'none';
    closeButton.style.color = 'white';
    closeButton.style.fontSize = '24px';
    closeButton.style.width = '40px';
    closeButton.style.height = '40px';
    closeButton.style.borderRadius = '50%';
    closeButton.style.cursor = 'pointer';
    closeButton.style.display = 'flex';
    closeButton.style.justifyContent = 'center';
    closeButton.style.alignItems = 'center';
    // closeButton.addEventListener('click', deactivateReorderMode);

    // Replace the direct deactivateReorderMode call with a confirmation dialog
    closeButton.addEventListener('click', () => {
      // Show confirmation dialog before exiting reorder mode
      ipcRenderer.send('show-confirmation-dialog', {
        title: 'Exit Reorder Mode',
        message: 'Exit PDF Reorder Mode?',
        detail: 'Any unsaved changes will be lost. Do you want to continue?',
        buttons: ['Cancel', 'Exit'],
        defaultId: 1,
        cancelId: 0
      });
      
      // Listen for the response
      ipcRenderer.once('confirmation-dialog-response', (_, response) => {
          if (response === 1) { // User clicked "Exit"
            // Remove this line that clears the PDF data
            // ipcRenderer.send('clear-current-pdf');
            
            // Just deactivate reorder mode without clearing PDF data
            deactivateReorderMode();
            
            console.log('Exited reorder mode without clearing PDF data');
          }
        });
      });
  
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Changes';
    saveButton.style.background = '#4285f4';
    saveButton.style.border = 'none';
    saveButton.style.color = 'white';
    saveButton.style.padding = '8px 16px';
    saveButton.style.borderRadius = '20px';
    saveButton.style.cursor = 'pointer';
    saveButton.style.fontSize = '14px';
    saveButton.addEventListener('click', saveReorderedPdf);
  
    controlsOverlay.appendChild(saveButton);
    controlsOverlay.appendChild(closeButton);
    previewSection.appendChild(controlsOverlay);


    // Add scroll buttons for better navigation with large documents
  const leftScrollButton = document.createElement('button');
  leftScrollButton.innerHTML = '&laquo;';
  leftScrollButton.className = 'scroll-button left-scroll';
  Object.assign(leftScrollButton.style, {
    position: 'fixed',
    left: '10px',
    bottom: '15%',
    zIndex: '1010',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  });
  
  const rightScrollButton = document.createElement('button');
  rightScrollButton.innerHTML = '&raquo;';
  rightScrollButton.className = 'scroll-button right-scroll';
  Object.assign(rightScrollButton.style, {
    position: 'fixed',
    right: '10px',
    bottom: '15%',
    zIndex: '1010',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  });
  
  // Add scroll event listeners
  leftScrollButton.addEventListener('click', () => {
    pagesContainer.scrollBy({ left: -300, behavior: 'smooth' });
  });
  
  rightScrollButton.addEventListener('click', () => {
    pagesContainer.scrollBy({ left: 300, behavior: 'smooth' });
  });
  
  // Add scroll buttons to the reorder container
  reorderContainer.appendChild(leftScrollButton);
  reorderContainer.appendChild(rightScrollButton)


  
    // Assemble the UI
    reorderContainer.appendChild(previewSection);
    reorderContainer.appendChild(pagesContainer);
  
    // Add the reorder container to the app
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.appendChild(reorderContainer);
    }
  }
  
  // Function to render PDF pages for reordering
  async function renderPdfPagesForReordering(pdfData) {
    try {
      showLoadingOverlay('Loading PDF pages...');
      
      // Load PDF document
      const pdfDoc = await PDFDocument.load(pdfData);
      const pageCount = pdfDoc.getPageCount();
      const fileSize = pdfData.byteLength;
      
      // Store the PDF document for later use
      pdfJsDoc = pdfDoc;

      console.log(`PDF loaded: ${pageCount} pages, ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
      
      // Clear pages container
      pagesContainer.innerHTML = '';
      
      // Initialize current page order
      currentPageOrder = Array.from({ length: pageCount }, (_, i) => i);
      
      // Determine document size category
      const isLargeDocument = pageCount > 30 || fileSize > 10 * 1024 * 1024; // 10MB
      const isVeryLargeDocument = pageCount > 100 || fileSize > 30 * 1024 * 1024; // 30MB
      
      if (isLargeDocument) {
        console.log(`Large document detected. Using optimized rendering.`);
        if (isVeryLargeDocument) {
          showWarningMessage(`This is a very large PDF (${(fileSize / (1024 * 1024)).toFixed(2)} MB, ${pageCount} pages). Thumbnails will load progressively to improve performance.`);
        }
      }
      
      
      // Create placeholders for all pages first
  // Create placeholders for all pages first - simplified DOM structure
  // Create placeholders for all pages first - optimized DOM structure
  for (let i = 0; i < pageCount; i++) {
    // Create page thumbnail container with minimal DOM elements
    const pageItem = document.createElement('div');
    pageItem.className = 'page-item';
    pageItem.dataset.pageIndex = i;
    pageItem.draggable = true;
    
    // Apply all styles directly to the page item
    Object.assign(pageItem.style, {
      position: 'relative',
      minWidth: '150px',
      height: '200px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      border: '1px solid #ddd',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      cursor: 'grab',
      transition: 'transform 0.2s, box-shadow 0.2s',
      backgroundColor: '#f5f5f5'
    });
    
    // Create thumbnail canvas directly in the page item
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.className = 'page-thumbnail-canvas';
    thumbnailCanvas.dataset.loaded = 'false';
    thumbnailCanvas.dataset.pageIndex = i;
    thumbnailCanvas.width = 150;
    thumbnailCanvas.height = 150;
    
    // Apply styles directly to canvas
    Object.assign(thumbnailCanvas.style, {
      width: '100%',
      height: '150px',
      objectFit: 'contain',
      margin: '0 auto',
      display: 'block'
    });
    
    // Draw placeholder
    const ctx = thumbnailCanvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${i + 1}`, thumbnailCanvas.width/2, thumbnailCanvas.height/2);
    
    // Add page number text using p element instead of div
    const pageNumberText = document.createElement('p');
    pageNumberText.textContent = `Page ${i + 1}`;
    
    // Apply styles directly
    Object.assign(pageNumberText.style, {
      padding: '8px',
      margin: '0',
      backgroundColor: '#f5f5f5',
      borderTop: '1px solid #ddd',
      textAlign: 'center',
      fontSize: '14px'
    });
    
    // Add drag handle as a simple span element
    const dragHandle = document.createElement('span');
    dragHandle.innerHTML = '⋮⋮';
    
    // Apply styles directly
    Object.assign(dragHandle.style, {
      position: 'absolute',
      top: '5px',
      right: '5px',
      color: '#666',
      fontSize: '16px',
      cursor: 'grab'
    });
    
    // Add hover effects directly to the page item
    pageItem.addEventListener('mouseover', () => {
      pageItem.style.transform = 'translateY(-5px)';
      pageItem.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    });
    
    pageItem.addEventListener('mouseout', () => {
      pageItem.style.transform = 'translateY(0)';
      pageItem.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
    });
    
    // Add click event to show preview
    pageItem.addEventListener('click', () => {
      // Remove highlight from all pages
      document.querySelectorAll('.page-item').forEach(item => {
        item.style.border = '1px solid #ddd';
      });
      // Highlight selected page
      pageItem.style.border = '2px solid #007bff';
      
      // Update preview
      const previewCanvas = document.querySelector('.preview-canvas');
      if (previewCanvas) {
        renderPageToCanvas(pdfDoc, i, previewCanvas, true);
      }
    });
    
    // Assemble page item with minimal DOM elements
    pageItem.appendChild(thumbnailCanvas);
    pageItem.appendChild(pageNumberText);
    pageItem.appendChild(dragHandle);
    
    // Add to container
    pagesContainer.appendChild(pageItem);

    // For large documents, add page navigation controls
    if (pageCount > 30) {
      addPageNavigationControls(pageCount);
    }
  }
      
  const initialRenderCount = isVeryLargeDocument ? 5 : (isLargeDocument ? 10 : 20);
  await renderThumbnailsInChunks(pdfDoc, 0, Math.min(initialRenderCount, pageCount));
  
  // Set up intersection observer for lazy loading the rest
  setupOptimizedLazyLoading(pdfDoc, isLargeDocument, isVeryLargeDocument);
  
  // Show the first page in preview
  const firstPageItem = document.querySelector('.page-item[data-page-index="0"]');
  if (firstPageItem) {
    firstPageItem.click();
    
    // Force scroll to the beginning - multiple attempts with increasing delays
    pagesContainer.scrollLeft = 0;
    
    // Multiple attempts to ensure scrolling works
    const scrollAttempts = [100, 300, 500, 1000];
    scrollAttempts.forEach(delay => {
      setTimeout(() => {
        pagesContainer.scrollLeft = 0;
        console.log(`Forced scroll to beginning (attempt at ${delay}ms)`);
      }, delay);
    });
    
    // For very large documents, add page navigation controls
    if (pageCount > 100) {
      addPageNavigationControls(pageCount);
    }
  }
  
  // Add a MutationObserver to ensure scroll position is maintained at 0
  const scrollObserver = new MutationObserver(() => {
    if (pagesContainer.scrollLeft > 0) {
      pagesContainer.scrollLeft = 0;
    }
  });
  
  // Start observing
  scrollObserver.observe(pagesContainer, { 
    childList: true, 
    subtree: true,
    attributes: true
  });
  
  // Disconnect after 2 seconds to avoid performance issues
  setTimeout(() => scrollObserver.disconnect(), 2000);
  
  hideLoadingOverlay();
} catch (error) {
  hideLoadingOverlay();
  console.error('Error rendering PDF pages:', error);
  showErrorDialog('Rendering Failed', 'Could not render PDF pages: ' + error.message);
}
  }


// Add this function to properly implement the page navigation controls
function addPageNavigationControls(pageCount) {
  // Remove existing controls if any
  const existingControls = document.querySelector('.page-navigation-controls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // Create navigation controls container
  const navControls = document.createElement('div');
  navControls.className = 'page-navigation-controls';
  Object.assign(navControls.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'white',
    padding: '10px 15px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    zIndex: '1000',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  });
  
  // Create page input container
  const pageInputContainer = document.createElement('div');
  Object.assign(pageInputContainer.style, {
    display: 'flex',
    alignItems: 'center'
  });
  
  // Create page number input
  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.min = '1';
  pageInput.max = pageCount.toString();
  pageInput.value = '1';
  Object.assign(pageInput.style, {
    width: '50px',
    padding: '5px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    textAlign: 'center'
  });
  
  // Create page count label
  const pageCountLabel = document.createElement('span');
  pageCountLabel.textContent = ` / ${pageCount}`;
  pageCountLabel.style.marginLeft = '5px';
  
  // Add input container to navigation controls
  pageInputContainer.appendChild(pageInput);
  pageInputContainer.appendChild(pageCountLabel);
  
  // First page button
  const firstPageBtn = document.createElement('button');
  firstPageBtn.className = 'page-nav-control';
  firstPageBtn.innerHTML = '&laquo;';
  firstPageBtn.title = 'First Page';
  firstPageBtn.style.cursor = 'pointer';
  firstPageBtn.style.padding = '5px 10px';
  firstPageBtn.style.border = '1px solid #ddd';
  firstPageBtn.style.borderRadius = '4px';
  firstPageBtn.style.backgroundColor = '#f8f8f8';
  
  // Previous page button
  const prevPageBtn = document.createElement('button');
  prevPageBtn.className = 'page-nav-control';
  prevPageBtn.innerHTML = '&lsaquo;';
  prevPageBtn.title = 'Previous Page';
  prevPageBtn.style.cursor = 'pointer';
  prevPageBtn.style.padding = '5px 10px';
  prevPageBtn.style.border = '1px solid #ddd';
  prevPageBtn.style.borderRadius = '4px';
  prevPageBtn.style.backgroundColor = '#f8f8f8';
  
  // Next page button
  const nextPageBtn = document.createElement('button');
  nextPageBtn.className = 'page-nav-control';
  nextPageBtn.innerHTML = '&rsaquo;';
  nextPageBtn.title = 'Next Page';
  nextPageBtn.style.cursor = 'pointer';
  nextPageBtn.style.padding = '5px 10px';
  nextPageBtn.style.border = '1px solid #ddd';
  nextPageBtn.style.borderRadius = '4px';
  nextPageBtn.style.backgroundColor = '#f8f8f8';
  
  // Last page button
  const lastPageBtn = document.createElement('button');
  lastPageBtn.className = 'page-nav-control';
  lastPageBtn.innerHTML = '&raquo;';
  lastPageBtn.title = 'Last Page';
  lastPageBtn.style.cursor = 'pointer';
  lastPageBtn.style.padding = '5px 10px';
  lastPageBtn.style.border = '1px solid #ddd';
  lastPageBtn.style.borderRadius = '4px';
  lastPageBtn.style.backgroundColor = '#f8f8f8';
  
  // Define the scrollToPage function if it doesn't exist
  if (typeof window.scrollToPage !== 'function') {
    window.scrollToPage = function(pageNum) {
      try {
        const pageItems = document.querySelectorAll('.page-item');
        if (pageItems.length === 0) {
          console.error('No page items found');
          return;
        }
        
        // Adjust for zero-based index
        const index = pageNum - 1;
        
        if (index >= 0 && index < pageItems.length) {
          // Get the target page element
          const targetPage = pageItems[index];
          
          // Get the container that needs to be scrolled
          const container = pagesContainer || document.querySelector('.pdf-pages-container');
          
          if (container) {
            // Calculate scroll position to center the target page
            const containerRect = container.getBoundingClientRect();
            const targetRect = targetPage.getBoundingClientRect();
            
            // Calculate the scroll position to center the target page
            const scrollLeft = targetPage.offsetLeft - (containerRect.width / 2) + (targetRect.width / 2);
            
            // Scroll with smooth behavior
            container.scrollTo({
              left: scrollLeft,
              behavior: 'smooth'
            });
            
            // Highlight the current page briefly
            targetPage.style.transition = 'box-shadow 0.3s ease';
            targetPage.style.boxShadow = '0 0 15px rgba(0, 123, 255, 0.7)';
            
            // Remove highlight after animation
            setTimeout(() => {
              targetPage.style.boxShadow = '';
            }, 1000);
            
            // Update the page input value
            pageInput.value = pageNum.toString();
          } else {
            console.error('Pages container not found');
          }
        } else {
          console.error(`Page index out of range: ${index}`);
        }
      } catch (error) {
        console.error('Error scrolling to page:', error);
      }
    };
  }
  
  // Add event listeners with proper error handling
  firstPageBtn.addEventListener('click', () => {
    try {
      scrollToPage(1);
      pageInput.value = '1';
    } catch (error) {
      console.error('Error navigating to first page:', error);
    }
  });
  
  prevPageBtn.addEventListener('click', () => {
    try {
      const currentPage = parseInt(pageInput.value, 10);
      if (currentPage > 1) {
        const newPage = currentPage - 1;
        scrollToPage(newPage);
        pageInput.value = newPage.toString();
      }
    } catch (error) {
      console.error('Error navigating to previous page:', error);
    }
  });
  
  nextPageBtn.addEventListener('click', () => {
    try {
      const currentPage = parseInt(pageInput.value, 10);
      if (currentPage < pageCount) {
        const newPage = currentPage + 1;
        scrollToPage(newPage);
        pageInput.value = newPage.toString();
      }
    } catch (error) {
      console.error('Error navigating to next page:', error);
    }
  });
  
  lastPageBtn.addEventListener('click', () => {
    try {
      scrollToPage(pageCount);
      pageInput.value = pageCount.toString();
    } catch (error) {
      console.error('Error navigating to last page:', error);
    }
  });
  
  pageInput.addEventListener('change', () => {
    try {
      let page = parseInt(pageInput.value, 10);
      
      // Validate input
      if (isNaN(page) || page < 1) {
        page = 1;
      } else if (page > pageCount) {
        page = pageCount;
      }
      
      // Update input value and scroll
      pageInput.value = page.toString();
      scrollToPage(page);
    } catch (error) {
      console.error('Error handling page input change:', error);
    }
  });
  
  // Add all elements to the navigation controls
  navControls.appendChild(firstPageBtn);
  navControls.appendChild(prevPageBtn);
  navControls.appendChild(pageInputContainer);
  navControls.appendChild(nextPageBtn);
  navControls.appendChild(lastPageBtn);
  
  // Add to document
  document.body.appendChild(navControls);
  
  // Add keyboard navigation
  document.addEventListener('keydown', (e) => {
    // Only handle navigation keys if we're not in an input field
    if (document.activeElement.tagName !== 'INPUT') {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevPageBtn.click();
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        nextPageBtn.click();
        e.preventDefault();
      } else if (e.key === 'Home') {
        firstPageBtn.click();
        e.preventDefault();
      } else if (e.key === 'End') {
        lastPageBtn.click();
        e.preventDefault();
      }
    }
  });
  
  return navControls;
}


// Function to trigger lazy loading for visible pages
function triggerLazyLoadingForVisiblePages() {
  try {
    const pageItems = document.querySelectorAll('.page-item');
    const viewportHeight = window.innerHeight;
    const buffer = viewportHeight * 2; // Load pages within 2x viewport height
    
    pageItems.forEach((pageItem, index) => {
      const rect = pageItem.getBoundingClientRect();
      
      // Check if page is visible or close to viewport
      const isNearViewport = 
        (rect.bottom >= -buffer && rect.top <= viewportHeight + buffer);
      
      if (isNearViewport) {
        // Find canvas that needs loading
        const canvas = pageItem.querySelector('canvas[data-loaded="false"]');
        if (canvas) {
          // Trigger loading for this page
          const pageIndex = parseInt(pageItem.dataset.pageIndex, 10);
          if (!isNaN(pageIndex)) {
            console.log(`Lazy loading page ${pageIndex + 1}`);
            loadPageThumbnail(pageIndex);
          }
        }
      }
    });
  } catch (error) {
    console.error('Error triggering lazy loading:', error);
  }
}


// Function to load a page thumbnail
function loadPageThumbnail(pageIndex) {
  try {
    // Find the canvas for this page
    const pageItem = document.querySelector(`.page-item[data-page-index="${pageIndex}"]`);
    if (!pageItem) return;
    
    const canvas = pageItem.querySelector('canvas');
    if (!canvas || canvas.dataset.loaded === 'true') return;
    
    // Mark as loading to prevent duplicate requests
    canvas.dataset.loading = 'true';
    
    // Show loading indicator
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', canvas.width/2, canvas.height/2);
    
    // Load the page
    if (pdfJsDoc) {
      renderPageToCanvas(pdfJsDoc, pageIndex, canvas, false, true)
        .then(() => {
          canvas.dataset.loaded = 'true';
          canvas.dataset.loading = 'false';
        })
        .catch(error => {
          console.error(`Error loading thumbnail for page ${pageIndex + 1}:`, error);
          canvas.dataset.loading = 'false';
          
          // Show error state
          ctx.fillStyle = '#ffebee';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#d32f2f';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Error', canvas.width/2, canvas.height/2);
        });
    }
  } catch (error) {
    console.error(`Error in loadPageThumbnail for page ${pageIndex + 1}:`, error);
  }
}



  async function renderThumbnailsInChunks(pdfDoc, startIndex, endIndex, chunkSize = 3) {
    const totalToRender = endIndex - startIndex;
    
    // Update loading message
    showLoadingOverlay(`Rendering thumbnails (0/${totalToRender})...`);
    
    for (let i = startIndex; i < endIndex; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize, endIndex);
      
      // Render a chunk of pages
      const renderPromises = [];
      for (let j = i; j < chunkEnd; j++) {
        const pageItem = document.querySelector(`.page-item[data-page-index="${j}"]`);
        if (pageItem) {
          const canvas = pageItem.querySelector('.page-thumbnail-canvas');
          if (canvas && canvas.dataset.loaded === 'false') {
            renderPromises.push(renderPageToCanvas(pdfDoc, j, canvas));
          }
        }
      }
      
      // Wait for all pages in this chunk to render
      await Promise.all(renderPromises);
      
      // Update loading message
      showLoadingOverlay(`Rendering thumbnails (${Math.min(chunkEnd, endIndex) - startIndex}/${totalToRender})...`);
      
      // Allow UI to update and garbage collection to run
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }


    // Function to set up optimized lazy loading with throttling
    function setupOptimizedLazyLoading(pdfDoc, isLargeDocument, isVeryLargeDocument) {
      const options = {
        root: pagesContainer,
        rootMargin: '200px',
        threshold: 0.1
      };
      
      // Use a throttled rendering queue for lazy loading
      let renderQueue = [];
      let isProcessingQueue = false;
      
      const processRenderQueue = async () => {
        if (isProcessingQueue || renderQueue.length === 0) return;
        
        isProcessingQueue = true;
        
        // Take a small batch from the queue
        const batchSize = isVeryLargeDocument ? 1 : (isLargeDocument ? 2 : 3);
        const batch = renderQueue.splice(0, batchSize);
        
        // Process this batch
        const renderPromises = batch.map(item => {
          const { pageIndex, canvas } = item;
          return renderPageToCanvas(pdfDoc, pageIndex, canvas);
        });
        
        await Promise.all(renderPromises);
        
        // Allow UI to update and garbage collection to run
        await new Promise(resolve => setTimeout(resolve, isVeryLargeDocument ? 100 : 50));
        
        isProcessingQueue = false;
        
        // Continue processing the queue if there are more items
        if (renderQueue.length > 0) {
          processRenderQueue();
        }
      };
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageItem = entry.target;
            const canvas = pageItem.querySelector('.page-thumbnail-canvas');
            
            if (canvas && canvas.dataset.loaded === 'false') {
              const pageIndex = parseInt(pageItem.dataset.pageIndex, 10);
              
              // Add to render queue instead of rendering immediately
              renderQueue.push({ pageIndex, canvas });
              
              // Start processing the queue if not already processing
              if (!isProcessingQueue) {
                processRenderQueue();
              }
            }
            
            // Stop observing this item
            observer.unobserve(pageItem);
          }
        });
      }, options);
      
      // Observe all page items
      document.querySelectorAll('.page-item').forEach(item => {
        observer.observe(item);
      });
    }

  // Create a placeholder for a page without rendering the content yet
  function createPagePlaceholder(pageIndex) {
    // Create page thumbnail container
    const pageItem = document.createElement('div');
    pageItem.className = 'page-item';
    pageItem.dataset.pageIndex = pageIndex;
    pageItem.draggable = true;
    
    // Apply all styles directly
    Object.assign(pageItem.style, {
      position: 'relative',
      width: '150px',
      height: '200px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      border: '1px solid #ddd',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      cursor: 'grab',
      transition: 'transform 0.2s, box-shadow 0.2s',
      backgroundColor: '#f5f5f5'
    });
    
    // Add hover effects
    pageItem.addEventListener('mouseover', () => {
      pageItem.style.transform = 'translateY(-5px)';
      pageItem.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    });
    
    pageItem.addEventListener('mouseout', () => {
      pageItem.style.transform = 'translateY(0)';
      pageItem.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
    });
    
    // Create thumbnail canvas directly
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.className = 'page-thumbnail-canvas';
    thumbnailCanvas.dataset.loaded = 'false';
    thumbnailCanvas.dataset.pageIndex = pageIndex;
    thumbnailCanvas.width = 150;
    thumbnailCanvas.height = 150;
    
    // Apply styles directly
    Object.assign(thumbnailCanvas.style, {
      width: '100%',
      height: '150px',
      objectFit: 'contain',
      margin: '0 auto',
      display: 'block'
    });
    
    // Draw placeholder
    const ctx = thumbnailCanvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    ctx.fillStyle = '#999';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${pageIndex + 1}`, thumbnailCanvas.width/2, thumbnailCanvas.height/2);
    
    // Create page number label using p element
    const pageNumber = document.createElement('p');
    pageNumber.className = 'page-number';
    pageNumber.textContent = `Page ${pageIndex + 1}`;
    
    // Apply styles directly
    Object.assign(pageNumber.style, {
      padding: '8px',
      margin: '0',
      backgroundColor: '#f5f5f5',
      borderTop: '1px solid #ddd',
      textAlign: 'center',
      fontSize: '14px'
    });
    
    // Add drag handle as span
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    
    // Apply styles directly
    Object.assign(dragHandle.style, {
      position: 'absolute',
      top: '5px',
      right: '5px',
      color: '#666',
      fontSize: '16px',
      cursor: 'grab'
    });
    
    // Assemble page item with minimal DOM elements
    pageItem.appendChild(thumbnailCanvas);
    pageItem.appendChild(pageNumber);
    pageItem.appendChild(dragHandle);
    
    return pageItem;
  }


    async function renderPageChunks(pdfDoc, startIndex, endIndex, chunkSize = 3) {
      const totalPages = endIndex - startIndex;
      
      // Update loading message
      showLoadingOverlay(`Rendering thumbnails (0/${totalPages})...`);
      
      for (let i = startIndex; i < endIndex; i += chunkSize) {
        const chunkEnd = Math.min(i + chunkSize, endIndex);
        
        // Render a chunk of pages
        const renderPromises = [];
        for (let j = i; j < chunkEnd; j++) {
          const pageItem = document.querySelector(`.page-item[data-page-index="${j}"]`);
          if (pageItem) {
            const canvas = pageItem.querySelector('.page-thumbnail-canvas');
            if (canvas && canvas.dataset.loaded === 'false') {
              // Add click event to show preview (only once per page item)
              if (!pageItem.dataset.hasClickListener) {
                pageItem.dataset.hasClickListener = 'true';
                pageItem.addEventListener('click', () => {
                  // Remove highlight from all pages
                  document.querySelectorAll('.page-item').forEach(item => {
                    item.style.border = '1px solid #ddd';
                  });
                  // Highlight selected page
                  pageItem.style.border = '2px solid #007bff';
                  
                  // Update preview
                  const previewCanvas = document.querySelector('.preview-canvas');
                  if (previewCanvas) {
                    // Use a lower quality preview for very large documents
                    const isVeryLarge = pdfDoc.getPageCount() > 50;
                    renderPageToCanvas(pdfDoc, j, previewCanvas, true, isVeryLarge);
                  }
                });
              }
              
              renderPromises.push(renderPageToCanvas(pdfDoc, j, canvas, false, false, true));
            }
          }
        }
        
        // Wait for all pages in this chunk to render
        await Promise.all(renderPromises);
        
        // Update loading message
        showLoadingOverlay(`Rendering thumbnails (${Math.min(chunkEnd, endIndex) - startIndex}/${totalPages})...`);
        
        // Allow UI to update and garbage collection to run
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      hideLoadingOverlay();
    }

    function setupEnhancedLazyLoading(pdfDoc, isVeryLargeDocument) {
      const options = {
        root: pagesContainer,
        rootMargin: '200px',
        threshold: 0.1
      };
      
      // Use a throttled rendering queue for lazy loading
      let renderQueue = [];
      let isProcessingQueue = false;
      
      const processRenderQueue = async () => {
        if (isProcessingQueue || renderQueue.length === 0) return;
        
        isProcessingQueue = true;
        
        // Take a small batch from the queue
        const batchSize = isVeryLargeDocument ? 2 : 3;
        const batch = renderQueue.splice(0, batchSize);
        
        // Process this batch
        const renderPromises = batch.map(item => {
          const { pageIndex, canvas } = item;
          return renderPageToCanvas(pdfDoc, pageIndex, canvas, false, isVeryLargeDocument);
        });
        
        await Promise.all(renderPromises);
        
        // Allow UI to update and garbage collection to run
        await new Promise(resolve => setTimeout(resolve, isVeryLargeDocument ? 100 : 50));
        
        isProcessingQueue = false;
        
        // Continue processing the queue if there are more items
        if (renderQueue.length > 0) {
          processRenderQueue();
        }
      };
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageItem = entry.target;
            const canvas = pageItem.querySelector('.page-thumbnail-canvas');
            
            if (canvas && canvas.dataset.loaded === 'false') {
              const pageIndex = parseInt(pageItem.dataset.pageIndex, 10);
              
              // Add to render queue instead of rendering immediately
              // Don't include pdfDoc in the queue item, we'll use the one passed to setupEnhancedLazyLoading
              renderQueue.push({ pageIndex, canvas });
              
              // Start processing the queue if not already processing
              if (!isProcessingQueue) {
                processRenderQueue();
              }
            }
            
            // Stop observing this item
            observer.unobserve(pageItem);
          }
        });
      }, options);
      
      // Observe all page items
      document.querySelectorAll('.page-item').forEach(item => {
        observer.observe(item);
      });
    }


  // Function to show a warning message
  function showWarningMessage(message, duration = 5000) {
    const warningDiv = document.createElement('div');
    warningDiv.style.position = 'fixed';
    warningDiv.style.top = '20px';
    warningDiv.style.left = '50%';
    warningDiv.style.transform = 'translateX(-50%)';
    warningDiv.style.backgroundColor = '#fff3cd';
    warningDiv.style.color = '#856404';
    warningDiv.style.padding = '12px 20px';
    warningDiv.style.borderRadius = '4px';
    warningDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    warningDiv.style.zIndex = '2000';
    warningDiv.style.maxWidth = '80%';
    warningDiv.style.textAlign = 'center';
    warningDiv.textContent = message;
    
    document.body.appendChild(warningDiv);
    
    setTimeout(() => {
      warningDiv.style.opacity = '0';
      warningDiv.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        if (warningDiv.parentNode) {
          warningDiv.parentNode.removeChild(warningDiv);
        }
      }, 500);
    }, duration);
  }



  function setupLazyLoading(pdfDoc) {
    const options = {
      root: pagesContainer,
      rootMargin: '100px',
      threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const canvas = entry.target.querySelector('.page-thumbnail-canvas');
          if (canvas && canvas.dataset.loaded === 'false') {
            const pageIndex = parseInt(canvas.dataset.pageIndex, 10);
            renderPageToCanvas(pdfDoc, pageIndex, canvas);
            canvas.dataset.loaded = 'true';
          }
          // Stop observing this item after loading
          observer.unobserve(entry.target);
        }
      });
    }, options);
    
    // Observe all page items
    document.querySelectorAll('.page-item').forEach(item => {
      observer.observe(item);
    });
  }


  
  // Function to enable drag and drop functionality using Sortable.js
  function enableDraggablePages() {
    // Use the module-level pagesContainer variable instead of querying the DOM again
    if (!pagesContainer) {
      console.error('Pages container not found');
      return null;
    }
    
    // Initialize Sortable on the pages container
    try {
      const sortable = Sortable.create(pagesContainer, {
        animation: 150, // Animation speed in ms
        ghostClass: 'sortable-ghost', // Class for the drop placeholder
        chosenClass: 'sortable-chosen', // Class for the chosen item
        dragClass: 'sortable-drag', // Class for the dragging item
        draggable: '.page-item', // Specify which items inside the element should be draggable
        forceFallback: false, // Force the fallback option
        fallbackClass: 'sortable-fallback',
        scroll: true, // Enable scrolling while dragging
        scrollSensitivity: 30, // Scroll sensitivity in pixels
        scrollSpeed: 10, // Scroll speed in pixels per frame
        
        // Called when dragging starts
        onStart: function(evt) {
          console.log('Drag started on page', evt.oldIndex);
          evt.item.classList.add('dragging');
          pagesContainer.classList.add('reorder-mode');
          
          // Highlight the page being dragged with a different background color only
          const pageNumber = evt.item.querySelector('.original-page-number');
          if (pageNumber) {
            pageNumber.style.backgroundColor = '#e3f2fd';
            // Keep text color black
            pageNumber.style.color = '#000';
            pageNumber.style.fontWeight = 'bold';
          }
          
          // Change drag handle color
          const dragHandle = evt.item.querySelector('span');
          if (dragHandle) {
            dragHandle.style.color = '#0d47a1';
          }
        },
        
        // Called when dragging ends
        onEnd: function(evt) {
          console.log('Drag ended');
          console.log('Reordering from', evt.oldIndex, 'to', evt.newIndex);
          evt.item.classList.remove('dragging');
          pagesContainer.classList.remove('reorder-mode');
          
          if (evt.oldIndex !== evt.newIndex) {
            // Update the current page order
            updatePageOrderAfterSort(evt.oldIndex, evt.newIndex);
            
            // Highlight the moved page temporarily
            const pageItem = evt.item;
            pageItem.style.backgroundColor = '#e3f2fd';
            pageItem.style.border = '2px solid #0d47a1';
            
            // Reset after animation
            setTimeout(() => {
              pageItem.style.backgroundColor = '#f5f5f5';
              pageItem.style.border = '1px solid #ddd';
            }, 1500);
          }
          
          // Reset page number background color but keep text color black
          const pageNumber = evt.item.querySelector('.original-page-number');
          if (pageNumber) {
            pageNumber.style.backgroundColor = '#f5f5f5';
            pageNumber.style.color = '#000';
            pageNumber.style.fontWeight = 'normal';
          }
          
          // Reset drag handle color
          const dragHandle = evt.item.querySelector('span');
          if (dragHandle) {
            dragHandle.style.color = '#666';
          }
        }
      });
      
      // Add CSS for Sortable visual feedback - ensure text stays black
      const style = document.createElement('style');
      style.textContent = `
        .sortable-ghost {
          opacity: 0.4;
          background-color: #c8e6ff !important;
          border: 2px dashed #4285f4 !important;
        }
        .sortable-ghost p {
          background-color: #c8e6ff !important;
          color: #000 !important;
        }
        .sortable-ghost span {
          color: #4285f4 !important;
        }
        .sortable-drag {
          opacity: 0.8;
          cursor: grabbing !important;
          box-shadow: 0 5px 15px rgba(0,0,0,0.2) !important;
          transform: scale(1.03) !important;
          z-index: 1000;
          background-color: #e6f0ff !important;
        }
        .sortable-drag p {
          background-color: #e6f0ff !important;
          color: #000 !important;
          font-weight: bold !important;
        }
        .sortable-drag span {
          color: #0d47a1 !important;
        }
        .sortable-chosen {
          background-color: #e6f0ff !important;
          border: 2px solid #4285f4 !important;
        }
        .sortable-chosen p {
          background-color: #e6f0ff !important;
          color: #000 !important;
        }
        .sortable-fallback {
          opacity: 0.7;
          transform: scale(1.03);
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
      `;
      document.head.appendChild(style);
      
      return sortable;
    } catch (error) {
      console.error('Error initializing Sortable:', error);
      return null;
    }
  }
  
  // Function to update the page order after sorting
  function updatePageOrderAfterSort(oldIndex, newIndex) {
    // Create a copy of the current page order
    const newOrder = [...currentPageOrder];
    
    // Remove the page from its original position
    const pageToMove = newOrder[oldIndex];
    newOrder.splice(oldIndex, 1);
    
    // Insert it at the new position
    newOrder.splice(newIndex, 0, pageToMove);
    
    // Update the current page order
    currentPageOrder = newOrder;
    
    console.log('New page order:', currentPageOrder);
    
    // Update page numbers to reflect new order
    updatePageNumbers();
  }
  
  // Function to update page numbers after reordering
  function updatePageNumbers() {
    const pageItems = document.querySelectorAll('.page-item');
    
    pageItems.forEach((item, index) => {
      // Update page index
      item.dataset.pageIndex = index;
      
      // Get the original index
      const originalIndex = currentPageOrder[index];
      
      // Update page number text - now using p element
      const pageNumberText = item.querySelector('p');
      if (pageNumberText) {
        pageNumberText.style.display = 'none';
      }
      
      // Update or add original page number for reference
      let originalNumEl = item.querySelector('.original-page-number');
      
      if (!originalNumEl) {
        originalNumEl = document.createElement('p');
        originalNumEl.className = 'original-page-number';
        Object.assign(originalNumEl.style, {
          padding: '8px',
          margin: '0',
          backgroundColor: '#f5f5f5',
          textAlign: 'center',
          fontSize: '14px',
          color: '#000' // Ensure text color is always black
        });
        item.appendChild(originalNumEl);
      } else {
        // Ensure existing elements have black text
        originalNumEl.style.color = '#000';
      }
      
      originalNumEl.textContent = `Page Order: ${originalIndex + 1}`;
    });
  }
  



  async function saveReorderedPdf() {
    try {
      showLoadingOverlay('Preparing reordered PDF...');
  
      // Verify we have the PDF data and page order
      if (!pdfJsDoc || !currentPageOrder || currentPageOrder.length === 0) {
        console.error('Missing PDF data or page order for saving');
        hideLoadingOverlay();
        showErrorDialog('Error', 'Cannot save: PDF data or page order is missing');
        return;
      }
      
      // Get the current PDF data
      let pdfData = await getCurrentPdf();
      
      if (!pdfData || !pdfData.buffer) {
        console.error('No PDF data available');
        throw new Error('No PDF data available');
      }
      
      console.log('Got PDF data, buffer size:', pdfData.buffer.length);
      
      // Get the current page order from the UI
      const currentOrder = Array.from(document.querySelectorAll('.page-item'))
        .map(page => {
          // Look for the original page number element
          const originalNumEl = page.querySelector('.original-page-number');
          if (originalNumEl) {
            // Extract the number from "Page Order: X"
            const match = originalNumEl.textContent.match(/Page Order: (\d+)/);
            if (match && match[1]) {
              // Convert to zero-based index
              return parseInt(match[1], 10) - 1;
            }
          }
          // Fallback to the page's current index if original can't be found
          return parseInt(page.dataset.pageIndex, 10);
        });
      
      console.log('Current page order for saving:', currentOrder);
      
      // IMPROVED APPROACH: Use the more efficient method to reorder pages
      // Load the PDF document once and reorder pages within it
      const pdfDoc = await PDFDocument.load(pdfData.buffer, {
        ignoreEncryption: true,
        updateMetadata: false
      });
      
      // Store references to all pages
      const pageCount = pdfDoc.getPageCount();
      console.log(`Original PDF has ${pageCount} pages`);
      
      // Create a copy of all pages
      const tempPages = [];
      for (let i = 0; i < pageCount; i++) {
        tempPages.push(pdfDoc.getPage(i));
      }
      
      // Remove all pages from the document (in reverse order to avoid index shifting)
      for (let i = pageCount - 1; i >= 0; i--) {
        pdfDoc.removePage(i);
      }
      
      // Add pages back in the desired order
      for (const pageIndex of currentOrder) {
        if (pageIndex >= 0 && pageIndex < tempPages.length) {
          // Add the page back to the document in the new order
          pdfDoc.addPage(tempPages[pageIndex]);
        } else {
          console.warn(`Skipping invalid page index: ${pageIndex}`);
        }
      }
      
      // Save with minimal processing to preserve quality
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
        preservePDFForm: true,
        updateMetadata: false
      });
      
      console.log(`Original PDF size: ${pdfData.buffer.length} bytes`);
      console.log(`Reordered PDF size: ${pdfBytes.length} bytes`);
      
      // Generate suggested output path based on the original file path
      let suggestedPath;
      if (pdfData.filePath) {
        const parsedPath = path.parse(pdfData.filePath);
        suggestedPath = path.join(
          parsedPath.dir,
          `${parsedPath.name}_reordered`
        );
      } else {
        suggestedPath = path.join(app.getPath('downloads'), `reordered`);
      }
      
      console.log('Suggested save path:', suggestedPath);
      
      // Hide loading overlay before showing save dialog
      hideLoadingOverlay();
      
      // Show Save As dialog instead of directly saving
      ipcRenderer.send('show-save-dialog', {
        title: 'Save Reordered PDF',
        defaultPath: suggestedPath,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      });
      
      // Wait for the user to select a save location
      const saveDialogResult = await new Promise((resolve) => {
        ipcRenderer.once('save-dialog-result', (_, result) => {
          resolve(result);
        });
        
        // Add timeout
        setTimeout(() => resolve({ canceled: true, error: 'Timeout' }), 60000);
      });
      
      // If user canceled the save dialog
      if (saveDialogResult.canceled) {
        console.log('Save dialog canceled by user');
        return;
      }
      
      // User selected a path, show loading overlay again
      showLoadingOverlay('Saving reordered PDF...');
      
      // User selected a path, save the file there
      const selectedPath = saveDialogResult.filePath;
      console.log('Saving to user-selected path:', selectedPath);
      
      // Save the file using IPC
      ipcRenderer.send('save-pdf', {
        buffer: Array.from(new Uint8Array(pdfBytes)),
        filePath: selectedPath
      });
      
      const saveResult = await new Promise((resolve) => {
        ipcRenderer.once('save-pdf-result', (_, data) => {
          resolve(data);
        });
        
        // Add timeout
        setTimeout(() => resolve({ success: false, error: 'Timeout' }), 30000);
      });
      
      hideLoadingOverlay();
      
      if (saveResult && saveResult.success) {
        // Show success dialog
        showSuccessDialog('PDF Saved', `Reordered PDF saved to: ${saveResult.filePath || selectedPath}`);
        
        // Add a button to open the folder
        const openFolderButton = document.createElement('button');
        openFolderButton.textContent = 'Open Containing Folder';
        openFolderButton.className = 'open-folder-button';
        openFolderButton.style.position = 'fixed';
        openFolderButton.style.top = '80px';
        openFolderButton.style.left = '50%';
        openFolderButton.style.transform = 'translateX(-50%)';
        openFolderButton.style.padding = '10px 20px';
        openFolderButton.style.backgroundColor = '#4CAF50';
        openFolderButton.style.color = 'white';
        openFolderButton.style.border = 'none';
        openFolderButton.style.borderRadius = '4px';
        openFolderButton.style.cursor = 'pointer';
        openFolderButton.style.zIndex = '2000';
        
        // Add hover effect
        openFolderButton.addEventListener('mouseover', () => {
          openFolderButton.style.backgroundColor = '#45a049';
        });
        openFolderButton.addEventListener('mouseout', () => {
          openFolderButton.style.backgroundColor = '#4CAF50';
        });
        
        // Add click handler
        openFolderButton.addEventListener('click', () => {
          const dirPath = path.dirname(saveResult.filePath || selectedPath);
          console.log('Opening folder:', dirPath);
          ipcRenderer.send('open-folder', dirPath);
          
          // Remove the button after clicking
          if (openFolderButton.parentNode) {
            openFolderButton.parentNode.removeChild(openFolderButton);
          }
        });
        
        document.body.appendChild(openFolderButton);
        
        // Auto-remove the button after 10 seconds
        setTimeout(() => {
          if (openFolderButton.parentNode) {
            openFolderButton.parentNode.removeChild(openFolderButton);
          }
        }, 10000);
      } else {
        showErrorDialog('Error', `Failed to save PDF: ${saveResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving reordered PDF:', error);
      hideLoadingOverlay();
      showErrorDialog('Error', `Failed to save reordered PDF: ${error.message}`);
    }
  }



  

// Helper function to compare arrays
function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  
  // Compare each element
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

  // Helper function to generate a save file path
  function getSaveFilePath(originalPath) {
    if (!originalPath) return '';
    
    const parsedPath = path.parse(originalPath);
    return path.join(
      parsedPath.dir,
      `${parsedPath.name}_reordered${parsedPath.ext}`
    );
  }

// Fix the createPageNavigationControls function to properly call addPageNavigationControls
function createPageNavigationControls(pageCount) {
  // This function should be a wrapper around addPageNavigationControls
  if (!pageCount && window.pdfDoc) {
    pageCount = window.pdfDoc.numPages;
  } else if (!pageCount && pdfJsDoc) {
    pageCount = pdfJsDoc.getPageCount();
  }
  
  if (pageCount) {
    return addPageNavigationControls(pageCount);
  } else {
    console.warn('Cannot create page navigation controls: pageCount is undefined');
    return null;
  }
}



// Helper function to show success message
function showSuccessMessage(message, duration = 3000) {
  const successDiv = document.createElement('div');
  successDiv.style.position = 'fixed';
  successDiv.style.top = '20px';
  successDiv.style.left = '50%';
  successDiv.style.transform = 'translateX(-50%)';
  successDiv.style.backgroundColor = '#d4edda';
  successDiv.style.color = '#155724';
  successDiv.style.padding = '12px 20px';
  successDiv.style.borderRadius = '4px';
  successDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  successDiv.style.zIndex = '2000';
  successDiv.style.maxWidth = '80%';
  successDiv.style.textAlign = 'center';
  successDiv.textContent = message;
  
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.style.opacity = '0';
    successDiv.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 500);
  }, duration);
}

  
// Function to reorder PDF pages
async function reorderPdf(pdfBytes, newOrder) {
  try {
    // Load the PDF document with preserving original content
    const pdfDoc = await PDFDocument.load(pdfBytes, { 
      updateMetadata: false,
      ignoreEncryption: true
    });
    
    // Store references to all pages
    const pageCount = pdfDoc.getPageCount();
    const tempPages = [];
    
    for (let i = 0; i < pageCount; i++) {
      tempPages.push(pdfDoc.getPage(i));
    }
    
    // Remove all pages from the document (in reverse order to avoid index shifting)
    for (let i = pageCount - 1; i >= 0; i--) {
      pdfDoc.removePage(i);
    }
    
    // Add pages back in the desired order
    for (const pageIndex of newOrder) {
      if (pageIndex >= 0 && pageIndex < tempPages.length) {
        pdfDoc.addPage(tempPages[pageIndex]);
      }
    }
    
    // Save with minimal processing to preserve quality
    return await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      preservePDFForm: true,
      updateMetadata: false
    });
  } catch (error) {
    console.error('Error reordering PDF:', error);
    throw error;
  }
}
  
  // Helper function to generate output path
    // Helper function to generate output path
    function generateOutputPath(inputPath) {
      if (!inputPath) return 'reordered.pdf';
      
      try {
        const parsedPath = path.parse(inputPath);
        // Save to the same directory as the input file
        return path.join(
          parsedPath.dir, 
          `${parsedPath.name}_reordered${parsedPath.ext}`
        );
      } catch (error) {
        console.error('Error generating output path:', error);
        // Fallback to saving in the current directory
        return `reordered-pdf-${Date.now()}.pdf`;
      }
    }
  
  // Helper function to convert ArrayBuffer to base64
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  // Helper function to show loading overlay
  // function showLoadingOverlay(message = 'Loading...') {
  //   // Check if overlay already exists
  //   let overlay = document.querySelector('.loading-overlay');
    
  //   if (!overlay) {
  //     overlay = document.createElement('div');
  //     overlay.className = 'loading-overlay';
  //     overlay.style.position = 'absolute';
  //     overlay.style.top = '0';
  //     overlay.style.left = '0';
  //     overlay.style.width = '100%';
  //     overlay.style.height = '100%';
  //     overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  //     overlay.style.display = 'flex';
  //     overlay.style.justifyContent = 'center';
  //     overlay.style.alignItems = 'center';
  //     overlay.style.zIndex = '1001';
      
  //     const spinner = document.createElement('div');
  //     spinner.className = 'loading-spinner';
  //     spinner.style.border = '4px solid #f3f3f3';
  //     spinner.style.borderTop = '4px solid #3498db';
  //     spinner.style.borderRadius = '50%';
  //     spinner.style.width = '40px';
  //     spinner.style.height = '40px';
  //     spinner.style.animation = 'spin 2s linear infinite';
      
  //     const messageElement = document.createElement('div');
  //     messageElement.className = 'loading-message';
  //     messageElement.textContent = message;
  //     messageElement.style.marginLeft = '10px';
  //     messageElement.style.fontWeight = 'bold';
      
  //     // Add keyframes for spinner animation
  //     const style = document.createElement('style');
  //     style.textContent = `
  //       @keyframes spin {
  //         0% { transform: rotate(0deg); }
  //         100% { transform: rotate(360deg); }
  //       }
  //     `;
  //     document.head.appendChild(style);
      
  //     overlay.appendChild(spinner);
  //     overlay.appendChild(messageElement);
      
  //     if (reorderContainer) {
  //       reorderContainer.appendChild(overlay);
  //     } else {
  //       document.body.appendChild(overlay);
  //     }
  //   } else {
  //     // Update message if overlay already exists
  //     const messageElement = overlay.querySelector('.loading-message');
  //     if (messageElement) {
  //       messageElement.textContent = message;
  //     }
  //   }
  // }
  
  // Helper function to hide loading overlay
  function hideLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
  
  // Helper function to show error dialog
function showErrorDialog(title, message) {
  // First try using the Electron API
  try {
    ipcRenderer.send('show-error-dialog', {
      title: title || 'Error',
      message: message
    });
  } catch (error) {
    // Fallback to browser alert if IPC fails
    console.error('Error showing dialog:', error);
    alert(`${title || 'Error'}: ${message}`);
  }
}

// Helper function to show success dialog
function showSuccessDialog(title, message) {
  // First try using the Electron API
  try {
    ipcRenderer.send('show-success-dialog', {
      title: title || 'Success',
      message: message
    });
  } catch (error) {
    // Fallback to browser alert if IPC fails
    console.error('Error showing dialog:', error);
    alert(`${title || 'Success'}: ${message}`);
  }
}
  
// Function to get the current PDF data
async function getCurrentPdf() {
  try {
    console.log('Attempting to get current PDF data...');
    
    // First check if we have a PDF already loaded in the window
    if (window.pdfDoc) {
      console.log('Found PDF document in window.pdfDoc');
      
      // Try to get the current PDF path from various sources
      let pdfPath = null;
      
      if (window.currentPdfPath) {
        pdfPath = window.currentPdfPath;
        console.log('Found PDF path in window.currentPdfPath:', pdfPath);
      } else if (window.pdfManagerData && window.pdfManagerData.currentPdfPath) {
        pdfPath = window.pdfManagerData.currentPdfPath;
        console.log('Found PDF path in window.pdfManagerData:', pdfPath);
      }
      
      // If we have a loaded PDF but no path, we can still use the PDF
      if (!pdfPath) {
        console.log('PDF document exists but no path found, using document directly');
        
        try {
          // Try to get the PDF data directly from the viewer
          const pdfData = await window.pdfDoc.getData();
          return {
            buffer: pdfData,
            filePath: 'current-document.pdf' // Use a default name
          };
        } catch (error) {
          console.log('Error getting PDF data from window.pdfDoc:', error);
        }
      }
      
      return {
        buffer: await window.pdfDoc.getData(),
        filePath: pdfPath
      };
    }
    
    // Check if we have PDF data in global storage
    if (window.pdfManagerData && window.pdfManagerData.currentPdfBuffer) {
      console.log('Found PDF buffer in global storage');
      return {
        buffer: window.pdfManagerData.currentPdfBuffer,
        filePath: window.pdfManagerData.currentPdfPath || 'document.pdf'
      };
    }
    
    // Try to get from the main process using IPC
    console.log('Requesting PDF data from main process...');
    
    // Use a Promise to handle the async operation
    return new Promise((resolve) => {
      // Try to get the current PDF info
      ipcRenderer.send('get-current-pdf-info');
      
      // Listen for the response
      ipcRenderer.once('current-pdf-info', (_, data) => {
        console.log('Received PDF info from main process:', !!data);
        
        if (data && data.buffer) {
          resolve({
            buffer: data.buffer,
            filePath: data.filePath || 'document.pdf'
          });
        } else {
          // If no data received, try to get just the path
          try {
            // Use a different channel that doesn't require a response
            ipcRenderer.send('request-current-pdf-path');
            
            ipcRenderer.once('current-pdf-path-response', (_, path) => {
              console.log('Received PDF path from main process:', path);
              
              if (path) {
                // Now request the buffer for this path
                ipcRenderer.send('get-pdf-data', { filePath: path });
                
                ipcRenderer.once('pdf-data-response', (_, data) => {
                  if (data && data.buffer) {
                    console.log('Received PDF buffer for path:', path);
                    resolve({
                      buffer: data.buffer,
                      filePath: path
                    });
                  } else {
                    resolve(null);
                  }
                });
              } else {
                resolve(null);
              }
            });
          } catch (error) {
            console.error('Error getting PDF path:', error);
            resolve(null);
          }
        }
      });

      ipcRenderer.once('current-pdf-data', (_, data) => {
        if (data && data.buffer) {
          console.log('Received current PDF data:', {
            filePath: data.filePath,
            bufferSize: data.buffer.length
          });
          resolve(data);
        } else {
          console.warn('No PDF data received from main process');
          resolve(null);
        }
      });
      
      // Add timeout
      setTimeout(() => {
        console.log('Timeout waiting for PDF info');
        resolve(null);
      }, 3000);
    });
  } catch (error) {
    console.error('Error in getCurrentPdf:', error);
    return null;
  }
}
  
// Helper function to generate a save file path
function generateOutputPath(originalPath) {
  if (!originalPath) {
    console.error('No original path provided to generateOutputPath');
    // Return an absolute path in the user's documents folder
    return path.join(app.getPath('documents'), `reordered-${Date.now()}.pdf`);
  }
  
  console.log('Generating output path from:', originalPath);
  
  try {
    // Check if the path is already absolute
    if (!path.isAbsolute(originalPath)) {
      // If it's not absolute, make it absolute by joining with current directory
      originalPath = path.resolve(originalPath);
      console.log('Converted to absolute path:', originalPath);
    }
    
    const parsedPath = path.parse(originalPath);
    const outputPath = path.join(
      parsedPath.dir,
      `${parsedPath.name}_reordered${parsedPath.ext}`
    );
    
    console.log('Generated output path:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('Error generating output path:', error);
    
    // Fallback to a simple approach with absolute path in documents folder
    return path.join(app.getPath('documents'), `reordered-${Date.now()}.pdf`);
  }
}
  
  // Utility to convert ArrayBuffer to Base64
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  async function renderPageToCanvas(pdfDoc, pageIndex, canvas, isPreview = false) {
    try {
      // Skip if already loaded and not forced
      if (canvas.dataset.loaded === 'true' && !isPreview) return;
      
      // Mark as loaded to prevent duplicate rendering
      canvas.dataset.loaded = 'true';
      
      // For large documents, use a lower quality rendering for thumbnails
      const pageCount = pdfDoc.getPageCount();
      const isLargeDocument = pageCount > 30;
      const isVeryLargeDocument = pageCount > 100;
      const qualityScale = isVeryLargeDocument ? 0.3 : (isLargeDocument ? 0.5 : 1.0);
      
      // Create a temporary copy of the PDF data for this specific page
      // This helps with memory management for large files
      let pdfBytes;
      let tempDoc;
      
      if (isLargeDocument && !isPreview) {
        // For large documents, extract just the single page we need
        tempDoc = await PDFDocument.create();
        const [copiedPage] = await tempDoc.copyPages(pdfDoc, [pageIndex]);
        tempDoc.addPage(copiedPage);
        pdfBytes = await tempDoc.save({ updateMetadata: false });
      } else {
        // For smaller documents or previews, use the full document
        pdfBytes = await pdfDoc.save({ updateMetadata: false });
      }
      
      // Use pdf.js to render the page
      const pdfJsDoc = await pdfjsLib.getDocument({data: pdfBytes}).promise;
      const pageNum = isLargeDocument && !isPreview ? 1 : pageIndex + 1; // If we extracted a single page, it's page 1
      const page = await pdfJsDoc.getPage(pageNum);
      
      // Get the original page dimensions
      const viewport = page.getViewport({scale: 1.0 * qualityScale});
      
      // Calculate scale to fit the canvas while preserving aspect ratio
      let scale;
      
      if (isPreview) {
        // For preview, use available space in the preview area
        const previewArea = canvas.parentElement;
        const maxWidth = previewArea ? previewArea.clientWidth - 40 : 600;
        const maxHeight = previewArea ? previewArea.clientHeight - 40 : 800;
        
        scale = Math.min(
          maxWidth / viewport.width,
          maxHeight / viewport.height
        ) * 0.95;
      } else {
        // For thumbnails, maintain aspect ratio within the fixed thumbnail size
        const thumbnailWidth = 150 * qualityScale;
        const thumbnailHeight = 150 * qualityScale;
        
        scale = Math.min(
          thumbnailWidth / viewport.width,
          thumbnailHeight / viewport.height
        );
      }
      
      const scaledViewport = page.getViewport({scale});
      
      // Set canvas dimensions to match the scaled viewport
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      // Center the canvas content
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      
      // Render the page with appropriate quality settings
      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        viewport: scaledViewport,
        // For thumbnails in large documents, use lower quality settings
        renderInteractiveForms: !isLargeDocument || isPreview,
        enableWebGL: false,
        renderTextLayer: false
      };
      
      await page.render(renderContext).promise;
      
      // Clean up to free memory
      if (tempDoc) {
        tempDoc = null;
      }
      
      // Force garbage collection if available (not standard, but helps in some environments)
      if (window.gc) {
        window.gc();
      } else if (window.collectGarbage) {
        window.collectGarbage(); // IE-specific
      }
      
      // For very large documents, reduce memory pressure by clearing the canvas reference in pdf.js
      if (isVeryLargeDocument && !isPreview) {
        renderContext.canvasContext = null;
        page.cleanup();
      }
    } catch (error) {
      console.error(`Error rendering page ${pageIndex + 1} thumbnail:`, error);
      // Draw a placeholder
      const ctx = canvas.getContext('2d');
      canvas.width = 150;
      canvas.height = 150;
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#999';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Page ${pageIndex + 1}`, canvas.width/2, canvas.height/2);
    }
  }







  function showLoadingOverlay(message = 'Loading...') {
    // Check if overlay already exists
    let overlay = document.querySelector('.loading-overlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.style.position = 'fixed'; // Changed from absolute to fixed for better coverage
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '1001';
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'loading-content';
      contentDiv.style.display = 'flex';
      contentDiv.style.flexDirection = 'column';
      contentDiv.style.alignItems = 'center';
      contentDiv.style.backgroundColor = 'white';
      contentDiv.style.padding = '20px';
      contentDiv.style.borderRadius = '8px';
      contentDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      contentDiv.style.textAlign = 'center'; // Center text content
      
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      spinner.style.border = '4px solid #f3f3f3';
      spinner.style.borderTop = '4px solid #3498db';
      spinner.style.borderRadius = '50%';
      spinner.style.width = '40px';
      spinner.style.height = '40px';
      spinner.style.animation = 'spin 2s linear infinite';
      
      const messageElement = document.createElement('div');
      messageElement.className = 'loading-message';
      messageElement.textContent = message;
      messageElement.style.marginTop = '10px';
      messageElement.style.fontWeight = 'bold';
      messageElement.style.marginBottom = '15px'; // Add space before cancel button
      
      // Add keyframes for spinner animation
      if (!document.getElementById('spinner-animation')) {
        const style = document.createElement('style');
        style.id = 'spinner-animation';
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
      
      contentDiv.appendChild(spinner);
      contentDiv.appendChild(messageElement);
      overlay.appendChild(contentDiv);
      
      document.body.appendChild(overlay);
    } else {
      // Update message if overlay already exists
      const messageElement = overlay.querySelector('.loading-message');
      if (messageElement) {
        messageElement.textContent = message;
      }
    }
  }
  
  // Update the code that adds the cancel button in saveReorderedPdf function
  // This should be placed right after the showLoadingOverlay call in saveReorderedPdf
  
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    const contentDiv = loadingOverlay.querySelector('.loading-content');
    if (contentDiv) {
      // Remove existing cancel button if any
      const existingButton = document.getElementById('cancel-compression');
      if (existingButton) {
        existingButton.remove();
      }
      
      const cancelButton = document.createElement('button');
      cancelButton.id = 'cancel-compression';
      cancelButton.textContent = 'Cancel';
      cancelButton.style.padding = '8px 20px';
      cancelButton.style.backgroundColor = '#f44336';
      cancelButton.style.color = 'white';
      cancelButton.style.border = 'none';
      cancelButton.style.borderRadius = '4px';
      cancelButton.style.cursor = 'pointer';
      cancelButton.style.fontWeight = 'bold';
      cancelButton.style.fontSize = '14px';
      cancelButton.style.display = 'block'; // Make it a block element
      cancelButton.style.margin = '0 auto'; // Center it horizontally
      
      // Add hover effect
      cancelButton.addEventListener('mouseover', () => {
        cancelButton.style.backgroundColor = '#d32f2f';
      });
      cancelButton.addEventListener('mouseout', () => {
        cancelButton.style.backgroundColor = '#f44336';
      });
      
      contentDiv.appendChild(cancelButton);
    }
  }
  
  

  
  // Public API
  return {
    init,
    activateReorderMode,
    deactivateReorderMode
  };
})();

// Export the module using CommonJS syntax
module.exports = ReorderTool;

// Make sure the module is properly initialized before exporting
console.log('ReorderTool module loaded and exported');

// Also add to window for direct access if window is defined
if (typeof window !== 'undefined') {
  window.ReorderTool = ReorderTool;
}