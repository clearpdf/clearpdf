// At the top of your file, add this import
// const PDFPasswordHandler = require('../utils/pdfPasswordHandler');
let lastAddPdfClick = 0;
let lastClickTime = 0;
const CLICK_DELAY = 300; // 300ms delay between 
let progressOverlay;


// MergeTool module for combining multiple PDFs
const MergeTool = (() => {
  let isRendering = false;
  let renderingTask = null;

  // Dependencies
  const { ipcRenderer } = require('electron');
  const fs = require('fs').promises;
  const path = require('path');
  
  // DOM elements
  let mergeContainer = null;
  let pdfListContainer = null;
  let fileNameInput = null;
  let combinePdfButton = null;
  let progressOverlay = null;
  let lastAddPdfClick = 0;
  let lastClickTime = 0;
  const CLICK_DELAY = 300;
  
  // State
  let pdfFiles = [];
  
  // Initialize the merge tool
  function init() {
    // Create merge UI if it doesn't exist
    if (!document.getElementById('merge-container')) {
      createMergeUI();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('MergeTool initialized successfully');
  }

  // Update the combinePdfs function with better error handling and debugging
  function combinePdfs() {
    console.log('combinePdfs called, pdfFiles length:', pdfFiles.length);
    
    if (pdfFiles.length === 0) {
      showErrorDialog('Error', 'No PDFs to combine. Please add at least one PDF.');
      return;
    }
    
    // Show progress overlay
    if (progressOverlay) {
      progressOverlay.style.display = 'flex';
      console.log('Progress overlay shown');

      // Reset progress bar
      const progressBarFill = document.querySelector('.progress-bar-fill');
      if (progressBarFill) {
        progressBarFill.style.width = '0%';
      }
      
      // Update message
      const progressMessage = document.querySelector('.progress-message');
      if (progressMessage) {
        progressMessage.textContent = 'Processing files...';
      }
    }
    
    // Get output file name
    let outputFileName = fileNameInput ? fileNameInput.value.trim() : 'Combined_Document.pdf';
    if (!outputFileName.endsWith('.pdf')) {
      outputFileName += '.pdf';
    }
    
    console.log('Output filename:', outputFileName);
    
    try {
      // Prepare PDF buffers - ensure we're sending valid buffers
      const pdfBuffers = pdfFiles.map((file, index) => {
        console.log(`Processing file ${index + 1}/${pdfFiles.length}: ${file.name}`);
        
        // Make sure we have a valid buffer
        if (!file.buffer) {
          console.error(`File ${file.name} has no buffer!`);
          return null;
        }
        
        if (file.buffer instanceof ArrayBuffer) {
          console.log(`File ${file.name} has ArrayBuffer, converting to Buffer`);
          return Buffer.from(file.buffer);
        } else {
          console.log(`File ${file.name} already has Buffer`);
          return file.buffer;
        }
      }).filter(buffer => buffer !== null);
      
      console.log(`Sending ${pdfBuffers.length} PDFs to main process for combining`);
      
      if (pdfBuffers.length === 0) {
        throw new Error('No valid PDF buffers to combine');
      }
      
      // Send to main process for combining
      ipcRenderer.send('combine-pdfs', {
        pdfBuffers,
        outputFileName
      });
      
      console.log('combine-pdfs message sent to main process');
    } catch (error) {
      console.error('Error in combinePdfs:', error);
      hideProgressUI();
      showErrorDialog('Error', `Failed to prepare PDFs for combining: ${error.message}`);
    }
  }
  
  // Create the merge UI
  function createMergeUI() {
    // Create main container
    mergeContainer = document.createElement('div');
    mergeContainer.id = 'merge-container';
    mergeContainer.className = 'merge-container';
    mergeContainer.style.display = 'none'; // Hidden by default
    mergeContainer.style.position = 'fixed';
    mergeContainer.style.top = '0';
    mergeContainer.style.left = '0';
    mergeContainer.style.width = '100%';
    mergeContainer.style.height = '100%';
    mergeContainer.style.backgroundColor = '#f5f5f5';
    mergeContainer.style.zIndex = '1000';
    mergeContainer.style.padding = '20px';
    mergeContainer.style.boxSizing = 'border-box';
    // Fix: Don't set flexDirection without display: flex
    // mergeContainer.style.flexDirection = 'column';
    
    mergeContainer.style.fontFamily = 'Arial, sans-serif';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'merge-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '20px';
    header.style.borderBottom = '1px solid #ddd';
    header.style.paddingBottom = '10px';
    
    // Create title
    const title = document.createElement('h2');
    title.textContent = 'Combine PDFs';
    title.style.margin = '0';
    title.style.color = '#333';
    title.style.fontSize = '24px';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.className = 'close-button';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '5px 10px';
    closeButton.style.color = '#666';
    closeButton.addEventListener('click', deactivateMergeMode);
    
    // Add elements to header
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create file name input container
    const fileNameContainer = document.createElement('div');
    fileNameContainer.className = 'filename-container';
    fileNameContainer.style.display = 'flex';
    fileNameContainer.style.alignItems = 'center';
    fileNameContainer.style.marginBottom = '20px';
    fileNameContainer.style.gap = '15px';
    fileNameContainer.style.maxWidth = '30vw';
    
    // Create label
    const fileNameLabel = document.createElement('label');
    fileNameLabel.textContent = 'Output File Name:';
    fileNameLabel.style.fontWeight = '500';
    fileNameLabel.style.marginRight = '10px';
    

    const addPdfButton = document.createElement('button');
    addPdfButton.textContent = 'Add PDF';
    addPdfButton.className = 'add-pdf-button';
    addPdfButton.style.padding = '10px 20px';
    addPdfButton.style.backgroundColor = 'rgb(163 255 187)'; 
    addPdfButton.style.color = 'rgb(59 107 40)';
    addPdfButton.style.border = 'none';
    addPdfButton.style.borderRadius = '4px';
    addPdfButton.style.cursor = 'pointer';
    addPdfButton.style.fontSize = '14px';
    addPdfButton.style.width = "10vw";
    addPdfButton.style.fontWeight = '500';
    addPdfButton.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
    addPdfButton.style.transition = 'all 0.2s ease';
    addPdfButton.addEventListener('click', addPdf);
    
    // Add elements to file name container
    // fileNameContainer.appendChild(fileNameLabel);
    // fileNameContainer.appendChild(fileNameInput);
     // Add hover effect

     addPdfButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Stop event bubbling
      e.preventDefault(); // Prevent default behavior
      addPdf();
    });
    
    fileNameContainer.appendChild(addPdfButton);

    // Create main content area with PDF list and preview
    const contentArea = document.createElement('div');
    contentArea.className = 'content-area';
    contentArea.style.display = 'flex';
    contentArea.style.flex = '1';
    contentArea.style.gap = '20px';
    contentArea.style.maxHeight = '76vh';
    
    // Create PDF list container
    pdfListContainer = document.createElement('div');
    pdfListContainer.className = 'pdf-list-container';
    pdfListContainer.style.flex = '1';
    pdfListContainer.style.overflowY = 'auto';
    pdfListContainer.style.border = '1px solid #ddd';
    pdfListContainer.style.borderRadius = '4px';
    pdfListContainer.style.padding = '10px';
    pdfListContainer.style.backgroundColor = '#fff';
    pdfListContainer.style.maxWidth = '67vw';
    pdfListContainer.style.maxHeight = '80vh';
    
    // Create empty state message
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.style.textAlign = 'center';
    emptyState.style.padding = '40px';
    emptyState.style.color = '#666';
    
    const emptyStateIcon = document.createElement('div');
    emptyStateIcon.innerHTML = '📄';
    emptyStateIcon.style.fontSize = '48px';
    emptyStateIcon.style.marginBottom = '10px';
    
    const emptyStateText = document.createElement('p');
    emptyStateText.textContent = 'No PDFs added yet. Click "Add PDF" to get started.';
    
    emptyState.appendChild(emptyStateIcon);
    emptyState.appendChild(emptyStateText);
    pdfListContainer.appendChild(emptyState);
    
    // Create PDF preview container
    // Create PDF preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'preview-container';
    previewContainer.style.flex = '1';
    previewContainer.style.border = '1px solid #ddd';
    previewContainer.style.borderRadius = '8px'; // Increased from 4px
    previewContainer.style.backgroundColor = '#fff';
    previewContainer.style.display = 'flex';
    previewContainer.style.flexDirection = 'column';
    previewContainer.style.position = 'relative';
    previewContainer.style.maxHeight = '70vh';
    previewContainer.style.maxWidth = '33vw';
    previewContainer.style.padding = '0 2rem';
    previewContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; // Added shadow
    previewContainer.style.margin = '0 10px'; // Added margin

    // Preview header
    const previewHeader = document.createElement('div');
    previewHeader.className = 'preview-header';
    previewHeader.style.borderBottom = '2px solid #f0f0f0'; // Changed from 1px to 2px and color
    previewHeader.style.paddingTop = '15px'; // Increased from 10px
    previewHeader.style.paddingBottom = '15px'; // Increased from 10px
    previewHeader.style.marginBottom = '15px'; // Increased from 10px
    previewHeader.style.display = 'flex';
    previewHeader.style.justifyContent = 'space-between';
    previewHeader.style.alignItems = 'center';

    const previewTitle = document.createElement('h3');
    previewTitle.textContent = 'Preview';
    previewTitle.style.margin = '0';
    previewTitle.style.color = '#e91e63';
    previewTitle.style.fontSize = '22px'; // Increased from 20px
    previewTitle.style.fontWeight = '600'; // Added font weight

    previewHeader.appendChild(previewTitle);

    // Preview content
    const previewContent = document.createElement('div');
    previewContent.className = 'preview-content';
    previewContent.style.flex = '1';
    previewContent.style.display = 'flex';
    previewContent.style.justifyContent = 'center';
    previewContent.style.alignItems = 'center';
    previewContent.style.position = 'relative';
    previewContent.style.padding = '15px 0'; // Added padding

    // Preview canvas - increase dimensions by 10%
    const previewCanvas = document.createElement('canvas');
    previewCanvas.id = 'preview-canvas';
    previewCanvas.width = 440;  // Increased from 400 (10% increase)
    previewCanvas.height = 572; // Increased from 520 (10% increase)
    previewCanvas.style.maxWidth = '100%';
    previewCanvas.style.maxHeight = '100%';
    previewCanvas.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)'; // Enhanced shadow
    previewCanvas.style.borderRadius = '4px'; // Added rounded corners

    // Preview navigation - improved buttons
    const prevButton = document.createElement('button');
    prevButton.className = 'preview-nav-button prev-button';
    prevButton.innerHTML = '&#10094;'; // Left arrow
    prevButton.style.position = 'absolute';
    prevButton.style.left = '10px';
    prevButton.style.top = '50%';
    prevButton.style.transform = 'translateY(-50%)';
    prevButton.style.backgroundColor = 'rgba(255,255,255,0.9)'; // More opaque
    prevButton.style.border = 'none';
    prevButton.style.borderRadius = '50%';
    prevButton.style.width = '45px'; // Increased from 40px
    prevButton.style.height = '45px'; // Increased from 40px
    prevButton.style.fontSize = '20px'; // Increased from 18px
    prevButton.style.cursor = 'pointer';
    prevButton.style.display = 'none'; // Hidden initially
    prevButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)'; // Added shadow
    prevButton.style.transition = 'all 0.2s ease'; // Added transition
    prevButton.addEventListener('click', () => navigatePreview(-1));

    // Add hover effect
    prevButton.addEventListener('mouseover', () => {
      prevButton.style.backgroundColor = 'rgba(233,30,99,0.1)';
    });
    prevButton.addEventListener('mouseout', () => {
      prevButton.style.backgroundColor = 'rgba(255,255,255,0.9)';
    });

    const nextButton = document.createElement('button');
    nextButton.className = 'preview-nav-button next-button';
    nextButton.innerHTML = '&#10095;'; // Right arrow
    nextButton.style.position = 'absolute';
    nextButton.style.right = '10px';
    nextButton.style.top = '50%';
    nextButton.style.transform = 'translateY(-50%)';
    nextButton.style.backgroundColor = 'rgba(255,255,255,0.9)'; // More opaque
    nextButton.style.border = 'none';
    nextButton.style.borderRadius = '50%';
    nextButton.style.width = '45px'; // Increased from 40px
    nextButton.style.height = '45px'; // Increased from 40px
    nextButton.style.fontSize = '20px'; // Increased from 18px
    nextButton.style.cursor = 'pointer';
    nextButton.style.display = 'none'; // Hidden initially
    nextButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)'; // Added shadow
    nextButton.style.transition = 'all 0.2s ease'; // Added transition
    nextButton.addEventListener('click', () => navigatePreview(1));

    // Add hover effect
    nextButton.addEventListener('mouseover', () => {
      nextButton.style.backgroundColor = 'rgba(233,30,99,0.1)';
    });
    nextButton.addEventListener('mouseout', () => {
      nextButton.style.backgroundColor = 'rgba(255,255,255,0.9)';
    });

    // Preview page info - improved styling
    const pageInfo = document.createElement('div');
    pageInfo.className = 'preview-page-info';
    pageInfo.style.position = 'absolute';
    pageInfo.style.bottom = '10px'; // Changed from 0px
    pageInfo.style.left = '50%';
    pageInfo.style.transform = 'translateX(-50%)';
    pageInfo.style.backgroundColor = 'rgba(233,30,99,0.1)'; // Pink tint matching title
    pageInfo.style.color = '#e91e63'; // Pink text
    pageInfo.style.padding = '6px 15px'; // Increased padding
    pageInfo.style.borderRadius = '20px'; // Increased from 15px
    pageInfo.style.fontSize = '14px';
    pageInfo.style.fontWeight = '500'; // Added font weight
    pageInfo.style.display = 'none'; // Hidden initially
    pageInfo.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; // Added shadow
    
    // Add elements to preview content
    previewContent.appendChild(previewCanvas);
    previewContent.appendChild(prevButton);
    previewContent.appendChild(nextButton);
    previewContent.appendChild(pageInfo);
    
    // Add elements to preview container
    previewContainer.appendChild(previewHeader);
    previewContainer.appendChild(previewContent);
    
    // Add list and preview to content area
    contentArea.appendChild(pdfListContainer);
    contentArea.appendChild(previewContainer);
    
    // Create actions container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'actions-container';
    actionsContainer.style.display = 'flex';
    actionsContainer.style.justifyContent = 'flex-end'; // Changed from space-between to flex-end
    actionsContainer.style.marginTop = '20px';
    actionsContainer.style.padding = '10px 0';
    actionsContainer.style.borderTop = '1px solid #ddd';

    // Create stats container for file count, total size and pages
    const statsContainer = document.createElement('div');
    statsContainer.className = 'pdf-stats-container';
    statsContainer.style.display = 'flex';
    statsContainer.style.alignItems = 'center';
    statsContainer.style.fontSize = '14px';
    statsContainer.style.color = '#666';
    statsContainer.style.padding = '5px 10px';
    statsContainer.style.backgroundColor = '#f5f5f5';
    statsContainer.style.borderRadius = '4px';

    // Create icon for stats
    const statsIcon = document.createElement('span');
    statsIcon.innerHTML = '📊';
    statsIcon.style.marginRight = '8px';
    statsIcon.style.fontSize = '16px';

    // Create text for stats
    const statsText = document.createElement('span');
    statsText.id = 'pdf-stats-text';
    statsText.textContent = 'No PDFs added';

    // Assemble stats container
    statsContainer.appendChild(statsIcon);
    statsContainer.appendChild(statsText);

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '10px';
    

    const rightContainer = document.createElement('div');
    rightContainer.style.display = 'flex';
    rightContainer.style.alignItems = 'center';
    rightContainer.style.gap = '15px';



    // Create combine button
    combinePdfButton = document.createElement('button');
    combinePdfButton.textContent = 'Combine PDFs';
    combinePdfButton.className = 'combine-pdf-button';
    combinePdfButton.style.padding = '10px 20px';
    combinePdfButton.style.backgroundColor = '#2196F3';
    combinePdfButton.style.color = 'white';
    combinePdfButton.style.border = 'none';
    combinePdfButton.style.borderRadius = '4px';
    combinePdfButton.style.cursor = 'pointer';
    combinePdfButton.style.fontSize = '14px';
    combinePdfButton.disabled = true;
    combinePdfButton.style.opacity = '0.5';

    // Add elements to right container
    rightContainer.appendChild(statsContainer);
    rightContainer.appendChild(combinePdfButton);

    // Add elements to actions container
    // actionsContainer.appendChild(addPdfButton);
    actionsContainer.appendChild(rightContainer);

    combinePdfButton.addEventListener('click', function() {
      if (window.MergeTool && typeof window.MergeTool.combinePdfs === 'function') {
        window.MergeTool.combinePdfs();
      } else {
        console.error('MergeTool.combinePdfs is not available');
        showErrorDialog('Error', 'The combine function is not available. Please refresh the application.');
      }
    });

    // Add buttons to buttons container
    // buttonsContainer.appendChild(addPdfButton);
    // buttonsContainer.appendChild(combinePdfButton);

    // // Add stats and buttons to actions container
    // actionsContainer.appendChild(statsContainer);
    // actionsContainer.appendChild(buttonsContainer);
    
    // Create progress overlay
    progressOverlay = document.createElement('div');
    progressOverlay.className = 'progress-overlay';
    progressOverlay.style.display = 'none';
    progressOverlay.style.position = 'fixed';
    progressOverlay.style.top = '0';
    progressOverlay.style.left = '0';
    progressOverlay.style.width = '100%';
    progressOverlay.style.height = '100%';
    progressOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    progressOverlay.style.zIndex = '2000';
    progressOverlay.style.justifyContent = 'center';
    progressOverlay.style.alignItems = 'center';
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.style.backgroundColor = 'white';
    progressContainer.style.padding = '20px';
    progressContainer.style.borderRadius = '8px';
    progressContainer.style.width = '400px';
    progressContainer.style.textAlign = 'center';
    
    const progressTitle = document.createElement('h3');
    progressTitle.className = 'progress-title';
    progressTitle.textContent = 'Combining PDFs...';
    progressTitle.style.marginBottom = '15px';
    
    const progressMessage = document.createElement('p');
    progressMessage.className = 'progress-message';
    progressMessage.textContent = 'Processing files...';
    progressMessage.style.marginBottom = '15px';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar-container';
    progressBar.style.width = '100%';
    progressBar.style.height = '20px';
    progressBar.style.backgroundColor = '#e0e0e0';
    progressBar.style.borderRadius = '10px';
    progressBar.style.overflow = 'hidden';
    
    const progressBarFill = document.createElement('div');
    progressBarFill.className = 'progress-bar-fill';
    progressBarFill.style.width = '0%';
    progressBarFill.style.height = '100%';
    progressBarFill.style.backgroundColor = '#4CAF50';
    progressBarFill.style.transition = 'width 0.3s ease';
    
    // Add cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'cancel-button';
    cancelButton.style.marginTop = '15px';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.backgroundColor = '#9e9e9e';
    cancelButton.style.color = 'white';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';

    cancelButton.addEventListener('click', () => {
      console.log('Cancel button clicked');
      // Cancel the PDF combination process
      ipcRenderer.send('cancel-pdf-combine');
      // Hide the progress overlay
      hideProgressUI();
    });

    progressBar.appendChild(progressBarFill);
    progressContainer.appendChild(progressTitle);
    progressContainer.appendChild(progressMessage);
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(cancelButton); // Add the cancel button
    progressOverlay.appendChild(progressContainer);
    
    // Assemble the UI
    mergeContainer.appendChild(header);
    mergeContainer.appendChild(fileNameContainer);
    // Replace this line:
    // mergeContainer.appendChild(pdfListContainer);
    // With this:
    mergeContainer.appendChild(contentArea); // Add the content area which contains both list and preview
    mergeContainer.appendChild(actionsContainer);
    
    // Add to the app
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.appendChild(mergeContainer);
      appElement.appendChild(progressOverlay);
    } else {
      // Fix: If app element not found, append to body
      document.body.appendChild(mergeContainer);
      document.body.appendChild(progressOverlay);
      console.warn('App element not found, appending to body instead');
    }
  }

  // Add this function to update PDF stats
  async function updatePdfStats() {
    const statsText = document.getElementById('pdf-stats-text');
    if (!statsText) return;
    
    if (pdfFiles.length === 0) {
      statsText.textContent = 'No PDFs added';
      return;
    }
    
    // Calculate total file size
    let totalSizeBytes = 0;
    pdfFiles.forEach(file => {
      totalSizeBytes += file.buffer.byteLength;
    });
    
    // Format file size
    let sizeText = '';
    if (totalSizeBytes < 1024) {
      sizeText = `${totalSizeBytes} B`;
    } else if (totalSizeBytes < 1024 * 1024) {
      sizeText = `${(totalSizeBytes / 1024).toFixed(1)} KB`;
    } else {
      sizeText = `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    
    // Start with basic stats
    statsText.textContent = `${pdfFiles.length} PDF${pdfFiles.length !== 1 ? 's' : ''} • ${sizeText}`;
    
    // Try to get total page count asynchronously
    try {
      let totalPages = 0;
      let loadedCount = 0;
      
      // Create a promise that resolves when all PDFs are processed or after a timeout
      await Promise.race([
        new Promise(async (resolve) => {
          for (const pdfFile of pdfFiles) {
            try {
              // Create a copy of the buffer to prevent detached ArrayBuffer issues
              const bufferCopy = new Uint8Array(pdfFile.buffer.slice()).buffer;
              
              // Try to load the PDF to get page count
              const loadingTask = window.pdfjsLib.getDocument({
                data: bufferCopy,
                password: '',
                disableAutoFetch: true,
                disableStream: true
              });
              
              const pdfDoc = await loadingTask.promise;
              totalPages += pdfDoc.numPages;
            } catch (error) {
              console.log(`Couldn't get page count for ${pdfFile.name}:`, error);
            }
            
            loadedCount++;
            
            // Update the stats text with current information
            statsText.textContent = `${pdfFiles.length} PDF${pdfFiles.length !== 1 ? 's' : ''} • ${sizeText} • ${totalPages} page${totalPages !== 1 ? 's' : ''}`;
            
            // If all PDFs are processed, resolve
            if (loadedCount === pdfFiles.length) {
              resolve();
            }
          }
        }),
        // Timeout after 3 seconds to prevent hanging
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      
    } catch (error) {
      console.error('Error calculating total pages:', error);
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('merge-pdfs-progress');
    ipcRenderer.removeAllListeners('merge-pdfs-complete');
    ipcRenderer.removeAllListeners('merge-pdfs-error');
    ipcRenderer.removeAllListeners('open-dialog-multiple-result');
    
    // Listen for merge-pdfs-progress events
    ipcRenderer.on('merge-pdfs-progress', (_, data) => {
      console.log('Progress update received:', data);
      updateProgressUI(data);
    });
    
    // Listen for merge-pdfs-complete events
    ipcRenderer.on('merge-pdfs-complete', (_, result) => {
      console.log('Merge complete received:', result);

      // Try multiple approaches to hide the progress overlay
      try {
        // First try the MergeTool function
        if (window.MergeTool && typeof window.MergeTool.hideProgressUI === 'function') {
          window.MergeTool.hideProgressUI();
        } 
        
        // Direct fallback if the function call didn't work
        if (progressOverlay && progressOverlay.style.display !== 'none') {
          progressOverlay.style.display = 'none';
          console.log('Progress overlay hidden directly');
        }
        
        // Additional fallback - try to find it by class name
        const overlayByClass = document.querySelector('.progress-overlay');
        if (overlayByClass && overlayByClass.style.display !== 'none') {
          overlayByClass.style.display = 'none';
          console.log('Progress overlay hidden by class selector');
        }
      } catch (e) {
        console.error('Error hiding progress overlay:', e);
      }
    });
    
    ipcRenderer.on('merge-pdfs-error', (_, error) => {
      console.error('Merge error received:', error);
      
      // Make sure we're calling the correct hideProgressUI function
      if (typeof window.MergeTool.hideProgressUI === 'function') {
        window.MergeTool.hideProgressUI();
      } else {
        // Fallback if the function isn't available on the exported object
        if (progressOverlay) {
          progressOverlay.style.display = 'none';
          console.log('Progress overlay hidden directly');
        }
      }
      
      showErrorDialog('Error', `Failed to combine PDFs: ${error.message || error}`);
    });
    
    // Listen for open-dialog-multiple-result events
    ipcRenderer.on('open-dialog-multiple-result', (_, result) => {
      console.log('Open dialog result received:', result);
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        processPdfFiles(result.filePaths);
      }
    });
  }
  
  // Process PDF files selected by the user
  async function processPdfFiles(filePaths) {
    try {
      for (const filePath of filePaths) {
        // Check if file already exists in the list
        if (pdfFiles.some(file => file.path === filePath)) {
          console.log(`File already in list: ${filePath}`);
          continue;
        }
        
        // Read the file
        const buffer = await fs.readFile(filePath);
        
        // Create a copy of the Node.js Buffer data
        const bufferCopy = new Uint8Array(buffer).slice().buffer;

        // Add to the list
        const pdfFile = {
            path: filePath,
            name: path.basename(filePath),
            buffer: bufferCopy,
            selected: true
        };
        
        pdfFiles.push(pdfFile);
      }
      
      // Update UI
      updatePdfListUI();
      
      // Enable combine button if we have PDFs
      if (pdfFiles.length > 0) {
        combinePdfButton.disabled = false;
        combinePdfButton.style.opacity = '1';
      }
    } catch (error) {
      console.error('Error processing PDF files:', error);
      showErrorDialog('Error', `Failed to process PDF files: ${error.message}`);
    }
  }
  
  // Update the PDF list UI
  // Modify the updatePdfListUI function to add proper null checks
  function updatePdfListUI() {
    // Clear the list properly
    while (pdfListContainer.firstChild) {
      pdfListContainer.removeChild(pdfListContainer.firstChild);
    }
    
    // If no PDFs, show empty state
    if (pdfFiles.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.style.textAlign = 'center';
      emptyState.style.padding = '40px';
      emptyState.style.color = '#666';
      
      const emptyStateIcon = document.createElement('div');
      emptyStateIcon.innerHTML = '📄';
      emptyStateIcon.style.fontSize = '48px';
      emptyStateIcon.style.marginBottom = '10px';
      
      const emptyStateText = document.createElement('p');
      emptyStateText.textContent = 'No PDFs added yet. Click "Add PDF" to get started.';
      
      emptyState.appendChild(emptyStateIcon);
      emptyState.appendChild(emptyStateText);
      pdfListContainer.appendChild(emptyState);
      
      // Hide preview when no PDFs - Add null checks
      const previewCanvas = document.getElementById('preview-canvas');
      if (previewCanvas) {
        previewCanvas.getContext('2d').clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      }
      
      // Add null checks for these elements
      const pageInfo = document.querySelector('.preview-page-info');
      if (pageInfo) pageInfo.style.display = 'none';
      
      const prevButton = document.querySelector('.prev-button');
      if (prevButton) prevButton.style.display = 'none';
      
      const nextButton = document.querySelector('.next-button');
      if (nextButton) nextButton.style.display = 'none';
      
      return;
    }
    
    // Create PDF items
    pdfFiles.forEach((pdfFile, index) => {
      // Create elements first
      const pdfItem = document.createElement('div');
      pdfItem.className = 'pdf-item';
      pdfItem.style.display = 'flex';
      pdfItem.style.alignItems = 'center';
      pdfItem.style.padding = '10px';
      pdfItem.style.borderBottom = '1px solid #eee';
      pdfItem.style.position = 'relative';
      pdfItem.style.cursor = 'pointer';
      
      // PDF icon
      const pdfIcon = document.createElement('div');
      pdfIcon.innerHTML = '📄';
      pdfIcon.style.fontSize = '24px';
      pdfIcon.style.marginRight = '10px';
      
      // PDF name
      const pdfName = document.createElement('div');
      pdfName.className = 'pdf-name';
      pdfName.textContent = pdfFile.name;
      pdfName.style.flex = '1';
      pdfName.style.overflow = 'hidden';
      pdfName.style.textOverflow = 'ellipsis';
      pdfName.style.whiteSpace = 'nowrap';
      
      // Remove button
      const removeButton = document.createElement('button');
      removeButton.textContent = '✕';
      removeButton.className = 'remove-pdf-button';
      removeButton.style.background = 'none';
      removeButton.style.border = 'none';
      removeButton.style.fontSize = '16px';
      removeButton.style.cursor = 'pointer';
      removeButton.style.padding = '5px 10px';
      removeButton.style.color = '#f44336';
      
      // Use a closure to capture the correct index
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        removePdf(index);
      });
      
      // Assemble the PDF item
      pdfItem.appendChild(pdfIcon);
      pdfItem.appendChild(pdfName);
      pdfItem.appendChild(removeButton);
      
      // Add to container
      pdfListContainer.appendChild(pdfItem);
      
      // Add plus icon between PDFs (except for the last one)
      if (index < pdfFiles.length - 1) {
        const plusIcon = document.createElement('div');
        plusIcon.className = 'plus-icon';
        plusIcon.innerHTML = '+';
        plusIcon.style.fontSize = '24px';
        plusIcon.style.margin = '10px auto';
        plusIcon.style.color = '#2196F3';
        plusIcon.style.width = '30px';
        plusIcon.style.height = '30px';
        plusIcon.style.lineHeight = '30px';
        plusIcon.style.textAlign = 'center';
        plusIcon.style.borderRadius = '50%';
        plusIcon.style.backgroundColor = '#e3f2fd';
        
        pdfListContainer.appendChild(plusIcon);
      }
    });
    
    // Update PDF stats after UI is updated
    updatePdfStats();
  }
  
  // Remove a PDF from the list
  function removePdf(index) {
    // Cancel any ongoing rendering first
    if (isRendering && renderingTask) {
      try {
        renderingTask.cancel();
        isRendering = false;
        renderingTask = null;
      } catch (e) {
        console.log('Error cancelling render task:', e);
      }
    }
    
    // Remove the PDF from the array
    pdfFiles.splice(index, 1);
    
    // Clear the canvas completely
    const previewCanvas = document.getElementById('preview-canvas');
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      // Reset any transformations that might be causing rotation
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      
      // Reset canvas dimensions to default to avoid scaling issues
      previewCanvas.width = 440;  // Reset to original width
      previewCanvas.height = 572; // Reset to original height
    }
    
    // Update UI
    updatePdfListUI();
    
    // If there are still PDFs, preview the first one
    if (pdfFiles.length > 0) {
      // Small delay to ensure the previous rendering is fully canceled
      setTimeout(() => {
        previewPdf(pdfFiles[0]);
      }, 200);
    } else {
      // Reset preview state
      currentPreviewPdf = null;
      currentPreviewPage = 1;
      totalPreviewPages = 0;
      
      // Hide navigation elements
      const pageInfo = document.querySelector('.preview-page-info');
      if (pageInfo) pageInfo.style.display = 'none';
      
      const prevButton = document.querySelector('.prev-button');
      if (prevButton) prevButton.style.display = 'none';
      
      const nextButton = document.querySelector('.next-button');
      if (nextButton) nextButton.style.display = 'none';
    }
    
    // Update PDF stats
    updatePdfStats();
    
    // Disable combine button if no PDFs
    if (pdfFiles.length === 0) {
      combinePdfButton.disabled = true;
      combinePdfButton.style.opacity = '0.5';
    }
  }
  
  // Add a PDF to the list
  // In the addPdf function, add a check for duplicates
   // Add a PDF to the list
  // In the addPdf function, add a check for duplicates
  // Modify the addPdf function to update stats
// Simplify the addPdf function to remove password handling
// Modify the addPdf function to check for password protection
function addPdf() {
  const now = Date.now();
  if (now - lastAddPdfClick < CLICK_DELAY) {
    console.log('Preventing duplicate file explorer open');
    return;
  }
  lastAddPdfClick = now;
  
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.multiple = true;
  
  
  input.onchange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check if file with same name already exists
      const isDuplicate = pdfFiles.some(existingFile => existingFile.name === file.name);
      if (isDuplicate) {
        console.log(`File ${file.name} already added, skipping duplicate`);
        continue;
      }
      
      try {
        // Read file as ArrayBuffer
        const buffer = await file.arrayBuffer();
        
        // Check if the PDF is password protected before adding it
        try {
          // Create a copy of the buffer to prevent detachment
          const bufferCopy = new Uint8Array(buffer).slice().buffer;
          
          // Load PDF.js if not already loaded
          if (!window.pdfjsLib) {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
              script.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
                resolve();
              };
              script.onerror = reject;
              document.head.appendChild(script);
            });
          }
          
          // Try to load the PDF to check if it's password protected
          await window.pdfjsLib.getDocument({
            data: bufferCopy,
            password: '',
            disableAutoFetch: true,
            disableStream: true
          }).promise;
          
          // If we get here, the PDF is not password protected
          // Create a copy of the buffer to prevent detachment
          const finalBufferCopy = new Uint8Array(buffer).slice().buffer;
          
          // Add to list
          pdfFiles.push({
            name: file.name,
            buffer: finalBufferCopy,
            file: file
          });
        } catch (passwordError) {
          // Check if it's a password exception
          if (passwordError.name === 'PasswordException') {
            // Show dialog that password protected PDFs cannot be combined
            showErrorDialog(
              'Password Protected PDF', 
              `The file "${file.name}" is password protected and cannot be combined. Please remove the password protection and try again.`
            );
          } else {
            throw passwordError; // Re-throw other errors
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        showErrorDialog('Error', `Failed to process file "${file.name}": ${error.message}`);
      }
    }
    
    // Update UI
    updatePdfListUI();
    
    // Update PDF stats
    updatePdfStats();
    
    // Enable combine button if we have at least 1 PDF
    if (pdfFiles.length >= 1) {
      combinePdfButton.disabled = false;
      combinePdfButton.style.opacity = '1';
    }
  };
  
  input.click();
}
  
  // Add these variables to the state section at the top of the file
  let currentPreviewPdf = null;
  let currentPreviewPage = 1;
  let totalPreviewPages = 0;
  
  // Add this function to handle PDF preview
  async function previewPdf(pdfFile, pageNum = 1) {
    try {
      const previewCanvas = document.getElementById('preview-canvas');
      const pageInfo = document.querySelector('.preview-page-info');
      const prevButton = document.querySelector('.prev-button');
      const nextButton = document.querySelector('.next-button');
      
      if (!previewCanvas || !pdfFile?.buffer) return;
      
      // If already rendering, cancel the previous operation
      if (isRendering && renderingTask) {
        console.log('Cancelling previous render operation');
        try {
          renderingTask.cancel();
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to ensure cancellation completes
        } catch (e) {
          console.log('Error cancelling previous render:', e);
        }
      }
      
      // Set rendering lock
      isRendering = true;
      renderingTask = null; // Reset the rendering task
      
      // Create a copy of the buffer to prevent detachment
      const bufferCopy = new Uint8Array(pdfFile.buffer.slice()).buffer;
      
      // Load PDF.js if not already loaded
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            resolve();
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      // Load the PDF document
      const loadingTask = window.pdfjsLib.getDocument({
        data: bufferCopy,
        disableAutoFetch: true,
        disableStream: true
      });
      
      const pdfDoc = await loadingTask.promise;
      
      // Store current preview state
      currentPreviewPdf = pdfFile;
      currentPreviewPage = pageNum;
      totalPreviewPages = pdfDoc.numPages;
      
      // Validate page number
      if (pageNum < 1) pageNum = 1;
      if (pageNum > totalPreviewPages) pageNum = totalPreviewPages;
      
      // Clear the canvas before rendering
      const context = previewCanvas.getContext('2d');
      context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      
      // Get the page
      const page = await pdfDoc.getPage(pageNum);
      
      // Render the page
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Calculate scale to fit within canvas
      const scaleX = previewCanvas.width / viewport.width;
      const scaleY = previewCanvas.height / viewport.height;
      const scale = Math.min(scaleX, scaleY);
      
      const scaledViewport = page.getViewport({ scale });
      
      // Update canvas dimensions to match the viewport
      previewCanvas.width = scaledViewport.width;
      previewCanvas.height = scaledViewport.height;
      
      // Store the rendering task so we can cancel it if needed
      renderingTask = page.render({
        canvasContext: context,
        viewport: scaledViewport
      });
      
      await renderingTask.promise;
      
      // Update page info
      if (pageInfo) {
        pageInfo.textContent = `Page ${pageNum} of ${totalPreviewPages}`;
        pageInfo.style.display = 'block';
      }
      
      // Show/hide navigation buttons
      if (prevButton) {
        prevButton.style.display = pageNum > 1 ? 'block' : 'none';
      }
      
      if (nextButton) {
        nextButton.style.display = pageNum < totalPreviewPages ? 'block' : 'none';
      }
      
      // Reset rendering lock
      isRendering = false;
    } catch (error) {
      console.error('Error previewing PDF:', error);
      isRendering = false;
      renderingTask = null;
    }
  }
  
  // Add this function to navigate between preview pages
  // Fix the navigatePreview function
  function navigatePreview(direction) {
    const newPage = currentPreviewPage + direction;
    if (newPage >= 1 && newPage <= totalPreviewPages && currentPreviewPdf) {
      // Simply update the page number without trying to recreate the PDF
      currentPreviewPage = newPage;
      
      // Find the selected PDF item
      const selectedItem = document.querySelector('.pdf-item[style*="background-color: rgb(227, 242, 253)"]');
      let selectedIndex = 0;
      
      if (selectedItem) {
        // Find the index of the selected item
        const allItems = document.querySelectorAll('.pdf-item');
        for (let i = 0; i < allItems.length; i++) {
          if (allItems[i] === selectedItem) {
            selectedIndex = i;
            break;
          }
        }
      }
      
      // Get the current PDF file from our array
      if (pdfFiles[selectedIndex]) {
        // Just render the new page without reloading the PDF
        renderPdfPage(currentPreviewPdf, newPage);
      }
    }
  }

// Add a rendering lock to prevent multiple simultaneous renders


  async function renderPdfPage(pdfDoc, pageNum) {
    const previewCanvas = document.getElementById('preview-canvas');
    const pageInfo = document.querySelector('.preview-page-info');
    const prevButton = document.querySelector('.prev-button');
    const nextButton = document.querySelector('.next-button');
    
    if (!previewCanvas) return;
    
    // If already rendering, cancel the previous operation
    if (isRendering && renderingTask) {
      console.log('Cancelling previous render operation');
      try {
        // Make sure we wait for the cancellation to complete
        renderingTask.cancel();
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to ensure cancellation completes
      } catch (e) {
        console.log('Error cancelling previous render:', e);
      }
    }
    
    try {
      // Set rendering lock
      isRendering = true;
      renderingTask = null; // Reset the rendering task
      
      // IMPORTANT: Reset canvas to original dimensions before rendering
      previewCanvas.width = 440;  // Reset to original width
      previewCanvas.height = 572; // Reset to original height
      
      // Create a copy of the buffer to prevent detachment
      const bufferCopy = new Uint8Array(pdfDoc.buffer.slice()).buffer;
      
      // Load the PDF document
      const pdfDocument = await window.pdfjsLib.getDocument({
        data: bufferCopy,
        disableAutoFetch: true,
        disableStream: true
      }).promise;
      
      // Get the page
      const page = await pdfDocument.getPage(pageNum);
      
      // Render the page
      const viewport = page.getViewport({ scale: 1.0 });
      const context = previewCanvas.getContext('2d');
      
      // Calculate scale to fit within canvas
      const scaleX = 440 / viewport.width;
      const scaleY = 572 / viewport.height;
      const scale = Math.min(scaleX, scaleY);
      
      const scaledViewport = page.getViewport({ scale });
      
      // Clear the canvas before rendering
      context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      
      // Render the page
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      };
      
      // Store the rendering task so we can cancel it if needed
      renderingTask = page.render(renderContext);
      await renderingTask.promise;
      
      // Update page info
      if (pageInfo) {
        pageInfo.textContent = `Page ${pageNum} of ${totalPreviewPages}`;
        pageInfo.style.display = 'block';
      }
      
      // Show/hide navigation buttons
      if (prevButton) {
        prevButton.style.display = pageNum > 1 ? 'block' : 'none';
      }
      
      if (nextButton) {
        nextButton.style.display = pageNum < totalPreviewPages ? 'block' : 'none';
      }
    } catch (error) {
      // Only log errors that aren't cancellation errors
      if (error.name !== 'RenderingCancelledException' && error.name !== 'OperatorError') {
        console.error('Error rendering PDF page:', error);
        
        // Show error on canvas
        const context = previewCanvas.getContext('2d');
        context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        context.font = '16px Arial';
        context.fillStyle = '#f44336';
        context.textAlign = 'center';
        context.fillText('Error rendering PDF page', previewCanvas.width / 2, previewCanvas.height / 2);
        context.font = '14px Arial';
        context.fillStyle = '#666';
        context.fillText(error.message || 'Unknown error', previewCanvas.width / 2, previewCanvas.height / 2 + 25);
      }
    } finally {
      // Release rendering lock when done
      isRendering = false;
    }
  }
  
  // Modify the updatePdfListUI function to add click event for previewing
  function updatePdfListUI() {
    // Clear the list
    pdfListContainer.innerHTML = '';
    
    // If no PDFs, show empty state
    if (pdfFiles.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.style.textAlign = 'center';
      emptyState.style.padding = '40px';
      emptyState.style.color = '#666';
      emptyState.style.cursor = 'pointer';
      
      const emptyStateIcon = document.createElement('div');
      emptyStateIcon.innerHTML = '<div style="width: 80px; height: 80px; background-color: #e3f2fd; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto; border: 2px solid #2196F3"><span style="font-size: 40px; color: #2196F3">+</span></div>';
      emptyStateIcon.style.marginBottom = '20px';
      
      const emptyStateText = document.createElement('p');
      emptyStateText.textContent = 'No PDFs added yet. Click to add PDFs';
      emptyStateText.style.color = '#2196F3';
      
      // Add click handler to trigger add PDF button
      emptyState.addEventListener('click', () => {
        const addPdfButton = document.querySelector('.add-pdf-button');
        if (addPdfButton) {
          addPdfButton.click();
        }
      });
      
      // Add hover effect
      emptyState.addEventListener('mouseover', () => {
        emptyStateIcon.querySelector('div').style.backgroundColor = '#bbdefb';
      });
      
      emptyState.addEventListener('mouseout', () => {
        emptyStateIcon.querySelector('div').style.backgroundColor = '#e3f2fd';
      });
      
      emptyState.appendChild(emptyStateIcon);
      emptyState.appendChild(emptyStateText);
      pdfListContainer.appendChild(emptyState);
      
      // Hide preview when no PDFs - Add null checks
      const previewCanvas = document.getElementById('preview-canvas');
      if (previewCanvas) {
        previewCanvas.getContext('2d').clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      }
      
      // Add null checks for these elements
      const pageInfo = document.querySelector('.preview-page-info');
      if (pageInfo) pageInfo.style.display = 'none';
      
      const prevButton = document.querySelector('.prev-button');
      if (prevButton) prevButton.style.display = 'none';
      
      const nextButton = document.querySelector('.next-button');
      if (nextButton) nextButton.style.display = 'none';
      
      return;
    }
    
    // Create PDF items
    // Create PDF items
pdfFiles.forEach((pdfFile, index) => {
  const pdfItem = document.createElement('div');
  pdfItem.className = 'pdf-item';
  pdfItem.style.display = 'flex';
  pdfItem.style.alignItems = 'center';
  pdfItem.style.padding = '10px';
  pdfItem.style.borderBottom = '1px solid #eee';
  pdfItem.style.position = 'relative';
  pdfItem.style.cursor = 'pointer';
  
  // Add hover effect
  pdfItem.style.transition = 'background-color 0.2s';
  pdfItem.addEventListener('mouseover', () => {
    pdfItem.style.backgroundColor = '#f5f5f5';
  });
  pdfItem.addEventListener('mouseout', () => {
    pdfItem.style.backgroundColor = '';
  });
  
  // Add click event to preview PDF
  pdfItem.addEventListener('click', () => {
    // Debounce mechanism to prevent rapid clicks
    const now = Date.now();
    if (now - lastClickTime < CLICK_DELAY) {
      console.log('Click too soon, ignoring');
      return;
    }
    lastClickTime = now;
    
    // Highlight selected item
    document.querySelectorAll('.pdf-item').forEach(item => {
      item.style.backgroundColor = '';
      item.style.borderLeft = '';
    });
    pdfItem.style.backgroundColor = '#e3f2fd';
    pdfItem.style.borderLeft = '4px solid #2196F3';
    
    // Preview the PDF
    previewPdf(pdfFile);
  });
  
  // Left side container for icon and name
  const leftContainer = document.createElement('div');
  leftContainer.style.display = 'flex';
  leftContainer.style.alignItems = 'center';
  leftContainer.style.flex = '1';
  leftContainer.style.minWidth = '0'; // Allows text to truncate properly
  
  // PDF icon
  const pdfIcon = document.createElement('div');
  pdfIcon.innerHTML = '📄';
  pdfIcon.style.fontSize = '24px';
  pdfIcon.style.marginRight = '10px';
  pdfIcon.style.flexShrink = '0';
  
  // Name and info container
  const nameInfoContainer = document.createElement('div');
  nameInfoContainer.style.minWidth = '0'; // Allows text to truncate properly
  nameInfoContainer.style.flex = '1';
  
  // PDF name
  const pdfName = document.createElement('div');
  pdfName.className = 'pdf-name';
  pdfName.textContent = pdfFile.name;
  pdfName.style.overflow = 'hidden';
  pdfName.style.textOverflow = 'ellipsis';
  pdfName.style.whiteSpace = 'nowrap';
  pdfName.style.fontWeight = '500';
  
  // PDF info (file size and pages)
  const pdfInfo = document.createElement('div');
  pdfInfo.className = 'pdf-info';
  pdfInfo.style.fontSize = '12px';
  pdfInfo.style.color = '#666';
  pdfInfo.style.marginTop = '2px';
  
  // Calculate file size
  const fileSizeKB = Math.round(pdfFile.buffer.byteLength / 1024);
  let fileSizeText = '';
  if (fileSizeKB < 1024) {
    fileSizeText = `${fileSizeKB} KB`;
  } else {
    const fileSizeMB = (fileSizeKB / 1024).toFixed(1);
    fileSizeText = `${fileSizeMB} MB`;
  }
  
  // Set initial info with file size
  pdfInfo.textContent = fileSizeText;
  
  // Try to get page count asynchronously
  setTimeout(async () => {
    try {
      // Create a copy of the buffer to prevent detached ArrayBuffer issues
      const bufferCopy = new Uint8Array(pdfFile.buffer.slice()).buffer;
      
      // Try to load the PDF to get page count
      const loadingTask = window.pdfjsLib.getDocument({
        data: bufferCopy,
        password: '',
        disableAutoFetch: true,
        disableStream: true
      });
      
      const pdfDoc = await loadingTask.promise;
      const pageCount = pdfDoc.numPages;
      
      // Update info with both file size and page count
      pdfInfo.textContent = `${fileSizeText} • ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
    } catch (error) {
      // If error (like password protected), just show file size
      console.log(`Couldn't get page count for ${pdfFile.name}:`, error);
    }
  }, 100);
  
  // Remove button
  const removeButton = document.createElement('button');
  removeButton.textContent = '✕';
  removeButton.className = 'remove-pdf-button';
  removeButton.style.background = 'none';
  removeButton.style.border = 'none';
  removeButton.style.fontSize = '16px';
  removeButton.style.cursor = 'pointer';
  removeButton.style.padding = '5px 10px';
  removeButton.style.color = '#f44336';
  removeButton.style.flexShrink = '0';
  removeButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering the parent click event
    removePdf(index);
  });
  
  // Add elements to containers
  nameInfoContainer.appendChild(pdfName);
  nameInfoContainer.appendChild(pdfInfo);
  
  leftContainer.appendChild(pdfIcon);
  leftContainer.appendChild(nameInfoContainer);
  
  // Add elements to PDF item
  pdfItem.appendChild(leftContainer);
  pdfItem.appendChild(removeButton);
  
  // Add plus icon between PDFs (except for the last one)
  if (index < pdfFiles.length - 1) {
    const plusIcon = document.createElement('div');
    plusIcon.className = 'plus-icon';
    plusIcon.innerHTML = '+';
    plusIcon.style.fontSize = '24px';
    plusIcon.style.margin = '10px auto';
    plusIcon.style.color = '#2196F3';
    plusIcon.style.width = '30px';
    plusIcon.style.height = '30px';
    plusIcon.style.lineHeight = '30px';
    plusIcon.style.textAlign = 'center';
    plusIcon.style.borderRadius = '50%';
    plusIcon.style.backgroundColor = '#e3f2fd';
    
    pdfListContainer.appendChild(pdfItem);
    pdfListContainer.appendChild(plusIcon);
  } else {
    pdfListContainer.appendChild(pdfItem);
  }
});
    
    // Preview the first PDF by default
    if (pdfFiles.length > 0) {
      previewPdf(pdfFiles[0]);
      // Highlight the first item
      const firstItem = document.querySelector('.pdf-item');
      if (firstItem) {
        firstItem.style.backgroundColor = '#e3f2fd';
        firstItem.style.borderLeft = '4px solid #2196F3';
      }
    }
    
    // Update PDF stats
    updatePdfStats();
  }
  
  // Activate merge mode
  function activateMergeMode() {
    // Make sure UI is created
    if (!document.getElementById('merge-container')) {
      createMergeUI();
    }
    
    // Reset state
    pdfFiles = [];
    if (fileNameInput) {
      fileNameInput.value = 'Combined_Document';
    }
    
    // Show UI first - before updating the PDF list
    if (mergeContainer) {
      mergeContainer.style.display = 'flex'; // Set to flex when activated
      mergeContainer.style.flexDirection = 'column'; // Add flex direction here
      console.log('Merge container activated and displayed');
      
      // Small delay to ensure DOM is updated before calling updatePdfListUI
      setTimeout(() => {
        updatePdfListUI();
        
        // Disable combine button if it exists
        if (combinePdfButton) {
          combinePdfButton.disabled = true;
          combinePdfButton.style.opacity = '0.5';
        }
      }, 50);
    } else {
      console.error('Merge container not found');
    }
  }
  
  // Deactivate merge mode
  function deactivateMergeMode() {
    // Hide UI
    if (mergeContainer) {
      mergeContainer.style.display = 'none';
    }
    
    // Reset state
    pdfFiles = [];
  }

  // Return public methods
  return {
    init,
    activateMergeMode,
    deactivateMergeMode,
    combinePdfs,
    hideProgressUI,  // Make sure this is included
    updateProgressUI
  };
})();

// Export the module
// if (typeof window !== 'undefined') {
  window.MergeTool = MergeTool;
// }

  // Initialize when the document is ready
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize MergeTool
    if (window.MergeTool) {
      window.MergeTool.init();
      console.log('MergeTool initialized, functions available:', 
        Object.keys(window.MergeTool).join(', '));
    } else {
      console.error('MergeTool not available on window object');
    }

    // Find the close button in the merge header
    const closeButton = document.querySelector('.merge-header .close-button');
    if (closeButton) {
      // Remove any existing event listeners
      const newCloseButton = closeButton.cloneNode(true);
      closeButton.parentNode.replaceChild(newCloseButton, closeButton);
      
      // Add the new event listener with warning
      newCloseButton.addEventListener('click', function(e) {
        e.preventDefault();
        // Show warning dialog directly instead of using MergeTool.showExitWarningDialog
        showExitWarningDialog();
      });
    }
  });

  // Helper function to hide progress UI
  function hideProgressUI() {
    if (progressOverlay) {
      // Remove any added buttons
      const buttonContainer = progressOverlay.querySelector('div:last-child:not(.progress-bar-container)');
      if (buttonContainer) {
        buttonContainer.remove();
      }
      
      progressOverlay.style.display = 'none';
      
      // Reset progress bar
      const progressBarFill = document.querySelector('.progress-bar-fill');
      if (progressBarFill) {
        progressBarFill.style.width = '0%';
        progressBarFill.style.backgroundColor = '#4CAF50'; // Reset color
      }
    }
  }

  
  // Helper function to show error dialog
    // Add this function if it doesn't exist
    function showErrorDialog(title, message) {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      overlay.style.zIndex = '2000';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      
      const dialog = document.createElement('div');
      dialog.style.backgroundColor = 'white';
      dialog.style.borderRadius = '8px';
      dialog.style.padding = '20px';
      dialog.style.width = '400px';
      dialog.style.maxWidth = '90%';
      
      const dialogTitle = document.createElement('h3');
      dialogTitle.textContent = title;
      dialogTitle.style.marginTop = '0';
      dialogTitle.style.color = '#f44336';
      
      const dialogMessage = document.createElement('p');
      dialogMessage.textContent = message;
      
      const closeButton = document.createElement('button');
      closeButton.textContent = 'OK';
      closeButton.style.padding = '8px 16px';
      closeButton.style.border = 'none';
      closeButton.style.borderRadius = '4px';
      closeButton.style.backgroundColor = '#f44336';
      closeButton.style.color = 'white';
      closeButton.style.cursor = 'pointer';
      closeButton.style.float = 'right';
      closeButton.style.marginTop = '15px';
      
      closeButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
      });
      
      dialog.appendChild(dialogTitle);
      dialog.appendChild(dialogMessage);
      dialog.appendChild(closeButton);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    }
  
  // Helper function to show success dialog
  function showSuccessDialog(title, message) {
    console.log(`${title}: ${message}`);
    alert(`${title}: ${message}`);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MergeTool;
  }
  
  // Helper function to update progress UI
  function updateProgressUI(data) {
    const progressBarFill = document.querySelector('.progress-bar-fill');
    const progressMessage = document.querySelector('.progress-message');
    
    if (!progressBarFill || !progressMessage) {
      console.error('Progress UI elements not found');
      return;
    }
    
    console.log('Updating progress UI:', data);
    
    if (data.status === 'loading') {
      progressBarFill.style.width = '10%';
      progressMessage.textContent = data.message || 'Starting...';
    } else if (data.status === 'processing') {
      progressBarFill.style.width = `${data.progress || 0}%`;
      progressMessage.textContent = data.message || 'Processing...';
    } else if (data.status === 'saving') {
      progressBarFill.style.width = '90%';
      progressMessage.textContent = data.message || 'Saving...';
    } else if (data.status === 'error') {
      progressBarFill.style.width = '100%';
      progressBarFill.style.backgroundColor = '#f44336';
      progressMessage.textContent = data.message || 'Error occurred';
      
      // Add a close button after error
      setTimeout(() => {
        hideProgressUI();
        showErrorDialog('Error', data.message || 'An error occurred while combining PDFs');
      }, 2000);
    }
  }
  
  // Helper function to hide progress UI
  function hideProgressUI() {
    if (progressOverlay) {
      // Remove any added buttons
      const buttonContainer = progressOverlay.querySelector('div:last-child:not(.progress-bar-container)');
      if (buttonContainer) {
        buttonContainer.remove();
      }
      
      progressOverlay.style.display = 'none';
      
      // Reset progress bar
      const progressBarFill = document.querySelector('.progress-bar-fill');
      if (progressBarFill) {
        progressBarFill.style.width = '0%';
        progressBarFill.style.backgroundColor = '#4CAF50'; // Reset color
      }
    }
  }

  progressOverlay.addEventListener('click', (e) => {
    // Only close if clicking directly on the overlay (not on its children)
    if (e.target === progressOverlay) {
      hideProgressUI();
    }
  });

  function showExitWarningDialog() {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'warning-dialog-overlay';
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'warning-dialog';
    
    // Create dialog header
    const header = document.createElement('div');
    header.className = 'warning-dialog-header';
    const title = document.createElement('h3');
    title.textContent = 'Exit Merge Mode';
    header.appendChild(title);
    
    // Create dialog body
    const body = document.createElement('div');
    body.className = 'warning-dialog-body';
    const message = document.createElement('p');
    message.textContent = 'Are you sure you want to exit? All unsaved changes and uploaded PDFs will be lost.';
    body.appendChild(message);
    
    // Create dialog footer
    const footer = document.createElement('div');
    footer.className = 'warning-dialog-footer';
    
    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.className = 'warning-dialog-button cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    // Create continue button
    const continueButton = document.createElement('button');
    continueButton.className = 'warning-dialog-button continue';
    continueButton.textContent = 'Exit Anyway';
    continueButton.addEventListener('click', () => {
      document.body.removeChild(overlay);
      // Simply hide the merge container directly
      const mergeContainer = document.getElementById('merge-container');
      if (mergeContainer) {
        mergeContainer.style.display = 'none';
      }
    });
    
    // Add buttons to footer
    footer.appendChild(cancelButton);
    footer.appendChild(continueButton);
    
    // Assemble dialog
    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    
    // Add to document
    document.body.appendChild(overlay);
  }

  // Function to actually close the merge panel
  function closeMergePanel() {
    // Clear all uploaded PDFs
    pdfFiles = [];
    updatePdfListUI();
    
    // Hide the merge panel
    const mergePanel = document.querySelector('.merge-panel');
    if (mergePanel) {
      mergePanel.classList.add('hidden');
    } else if (mergeContainer) {
      mergeContainer.style.display = 'none';
    }
    
    // Clear any previews
    const previewCanvas = document.getElementById('preview-canvas');
    if (previewCanvas) {
      const context = previewCanvas.getContext('2d');
      context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    
    // Reset variables
    currentPreviewPdf = null;
    totalPreviewPages = 0;
    currentPreviewPage = 1;
  }

  