// Browser-based PDF Merge Tool
// This version works without Electron, using only browser APIs

const BrowserMergeTool = (() => {
    // State
    let pdfFiles = [];
    let currentPreviewFile = null;
    let currentPreviewPage = 1;
    let previewPageCount = 0;
    let isRendering = false;
    let renderingTask = null;
    
    // DOM elements
    let mergeContainer = null;
    let pdfListContainer = null;
    let fileNameInput = null;
    let combinePdfButton = null;
    let progressOverlay = null;
    
    // Initialize function
    function init() {
        // Load required libraries first
        Promise.all([loadPDFJS(), loadPDFLib()])
          .then(() => {
            console.log('PDF libraries loaded successfully');
            createMergeUI(); // Changed from createUI() to createMergeUI()
            setupEventListeners();
          })
          .catch(error => {
            console.error('Error loading PDF libraries:', error);
            showErrorDialog('Error', 'Failed to load required libraries. Please try again later.');
          });
      }
    
    // Create the merge UI
    function createMergeUI() {
      // Create main container
      mergeContainer = document.createElement('div');
      mergeContainer.id = 'merge-container';
      mergeContainer.className = 'merge-container';
      mergeContainer.style.display = 'flex';
      mergeContainer.style.flexDirection = 'column';
      mergeContainer.style.position = 'fixed';
      mergeContainer.style.top = '0';
      mergeContainer.style.left = '0';
      mergeContainer.style.width = '100%';
      mergeContainer.style.height = '100%';
      mergeContainer.style.backgroundColor = '#f5f5f5';
      mergeContainer.style.zIndex = '1000';
      mergeContainer.style.padding = '20px';
      mergeContainer.style.boxSizing = 'border-box';
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
      

      
      // Create add PDF button
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
      addPdfButton.style.fontWeight = '500';
      addPdfButton.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
      addPdfButton.style.transition = 'all 0.2s ease';
      
      // Add hover effect
      addPdfButton.addEventListener('mouseover', () => {
        addPdfButton.style.backgroundColor = 'rgb(143 235 167)';
      });
      addPdfButton.addEventListener('mouseout', () => {
        addPdfButton.style.backgroundColor = 'rgb(163 255 187)';
      });
      
      addPdfButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        addPdf();
      });
      
      // Add elements to file name container
      fileNameContainer.appendChild(addPdfButton);
      
      // Create main content area with PDF list and preview
      const contentArea = document.createElement('div');
      contentArea.className = 'content-area';
      contentArea.style.display = 'flex';
      contentArea.style.flex = '1';
      contentArea.style.gap = '20px';
      contentArea.style.maxHeight = '76vh';
      contentArea.style.overflow = 'hidden';
      
      // Create PDF list container
      pdfListContainer = document.createElement('div');
      pdfListContainer.className = 'pdf-list-container';
      pdfListContainer.style.flex = '1';
      pdfListContainer.style.overflowY = 'auto';
      pdfListContainer.style.border = '1px solid #ddd';
      pdfListContainer.style.borderRadius = '4px';
      pdfListContainer.style.padding = '10px';
      pdfListContainer.style.backgroundColor = '#fff';
      pdfListContainer.style.maxWidth = '67%';
      
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
      const previewContainer = document.createElement('div');
      previewContainer.className = 'preview-container';
      previewContainer.style.flex = '1';
      previewContainer.style.border = '1px solid #ddd';
      previewContainer.style.borderRadius = '8px';
      previewContainer.style.backgroundColor = '#fff';
      previewContainer.style.display = 'flex';
      previewContainer.style.flexDirection = 'column';
      previewContainer.style.position = 'relative';
      previewContainer.style.maxHeight = '-webkit-fill-available';
      previewContainer.style.maxWidth = '33%';
      previewContainer.style.padding = '0 2rem';
      previewContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      previewContainer.style.margin = '0 10px';
      
      // Preview header
      const previewHeader = document.createElement('div');
      previewHeader.className = 'preview-header';
      previewHeader.style.borderBottom = '2px solid #f0f0f0';
      previewHeader.style.paddingTop = '15px';
      previewHeader.style.paddingBottom = '15px';
      previewHeader.style.marginBottom = '15px';
      previewHeader.style.display = 'flex';
      previewHeader.style.justifyContent = 'space-between';
      previewHeader.style.alignItems = 'center';
      
      const previewTitle = document.createElement('h3');
      previewTitle.textContent = 'Preview';
      previewTitle.style.margin = '0';
      previewTitle.style.color = '#e91e63';
      previewTitle.style.fontSize = '22px';
      previewTitle.style.fontWeight = '600';
      
      previewHeader.appendChild(previewTitle);
      
      // Preview content
      const previewContent = document.createElement('div');
      previewContent.className = 'preview-content';
      previewContent.style.flex = '1';
      previewContent.style.display = 'flex';
      previewContent.style.justifyContent = 'center';
      previewContent.style.alignItems = 'center';
      previewContent.style.position = 'relative';
      previewContent.style.padding = '15px 0';
      
      // Preview canvas
      const previewCanvas = document.createElement('canvas');
      previewCanvas.id = 'preview-canvas';
      previewCanvas.width = 440;
      previewCanvas.height = 572;
      previewCanvas.style.maxWidth = '100%';
      previewCanvas.style.maxHeight = '100%';
      previewCanvas.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
      previewCanvas.style.borderRadius = '4px';
      
      // Preview navigation buttons
      const prevButton = document.createElement('button');
      prevButton.className = 'preview-nav-button prev-button';
      prevButton.innerHTML = '&#10094;'; // Left arrow
      prevButton.style.position = 'absolute';
      prevButton.style.left = '10px';
      prevButton.style.top = '50%';
      prevButton.style.transform = 'translateY(-50%)';
      prevButton.style.backgroundColor = 'rgba(255,255,255,0.9)';
      prevButton.style.border = 'none';
      prevButton.style.borderRadius = '50%';
      prevButton.style.width = '45px';
      prevButton.style.height = '45px';
      prevButton.style.fontSize = '20px';
      prevButton.style.cursor = 'pointer';
      prevButton.style.display = 'none'; // Hidden initially
      prevButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      prevButton.style.transition = 'all 0.2s ease';
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
      nextButton.style.backgroundColor = 'rgba(255,255,255,0.9)';
      nextButton.style.border = 'none';
      nextButton.style.borderRadius = '50%';
      nextButton.style.width = '45px';
      nextButton.style.height = '45px';
      nextButton.style.fontSize = '20px';
      nextButton.style.cursor = 'pointer';
      nextButton.style.display = 'none'; // Hidden initially
      nextButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      nextButton.style.transition = 'all 0.2s ease';
      nextButton.addEventListener('click', () => navigatePreview(1));
      
      // Add hover effect
      nextButton.addEventListener('mouseover', () => {
        nextButton.style.backgroundColor = 'rgba(233,30,99,0.1)';
      });
      nextButton.addEventListener('mouseout', () => {
        nextButton.style.backgroundColor = 'rgba(255,255,255,0.9)';
      });
      
      // Preview page info
      const pageInfo = document.createElement('div');
      pageInfo.className = 'preview-page-info';
      pageInfo.style.position = 'absolute';
      pageInfo.style.bottom = '10px';
      pageInfo.style.left = '50%';
      pageInfo.style.transform = 'translateX(-50%)';
      pageInfo.style.backgroundColor = 'rgba(233,30,99,0.1)';
      pageInfo.style.color = '#e91e63';
      pageInfo.style.padding = '6px 15px';
      pageInfo.style.borderRadius = '20px';
      pageInfo.style.fontSize = '14px';
      pageInfo.style.fontWeight = '500';
      pageInfo.style.display = 'none'; // Hidden initially
      pageInfo.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      
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
      actionsContainer.style.justifyContent = 'flex-end';
      actionsContainer.style.marginTop = '20px';
      actionsContainer.style.padding = '10px 0';
      actionsContainer.style.borderTop = '1px solid #ddd';
      
      // Create stats container
      const statsContainer = document.createElement('div');
      statsContainer.className = 'pdf-stats-container';
      statsContainer.style.display = 'flex';
      statsContainer.style.alignItems = 'center';
      statsContainer.style.fontSize = '14px';
      statsContainer.style.color = '#666';
      statsContainer.style.padding = '5px 10px';
      statsContainer.style.backgroundColor = '#f5f5f5';
      statsContainer.style.borderRadius = '4px';
      statsContainer.style.marginRight = '15px';
      
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
      combinePdfButton.addEventListener('click', combinePdfs);
      
      // Add hover effect when enabled
      combinePdfButton.addEventListener('mouseover', () => {
        if (!combinePdfButton.disabled) {
          combinePdfButton.style.backgroundColor = '#1976D2';
        }
      });
      combinePdfButton.addEventListener('mouseout', () => {
        if (!combinePdfButton.disabled) {
          combinePdfButton.style.backgroundColor = '#2196F3';
        }
      });
      
      // Add elements to actions container
      actionsContainer.appendChild(statsContainer);
      actionsContainer.appendChild(combinePdfButton);
      
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
      
      progressBar.appendChild(progressBarFill);
      progressContainer.appendChild(progressTitle);
      progressContainer.appendChild(progressMessage);
      progressContainer.appendChild(progressBar);
      progressOverlay.appendChild(progressContainer);
      
      // Assemble the main container
      mergeContainer.appendChild(header);
      mergeContainer.appendChild(fileNameContainer);
      mergeContainer.appendChild(contentArea);
      mergeContainer.appendChild(actionsContainer);
      mergeContainer.appendChild(progressOverlay);
      
      // Add to document
      document.body.appendChild(mergeContainer);
    }
    
    // Set up event listeners
    // Set up event listeners
    function setupEventListeners() {
        // Listen for combine-complete event
        document.addEventListener('combine-complete', (e) => {
          hideProgressUI();
          
          if (e.detail && e.detail.success) {
            // Create a filename with .pdf extension if needed
            let filename = fileNameInput ? fileNameInput.value.trim() : 'Combined_Document.pdf';
            if (!filename.endsWith('.pdf')) {
              filename += '.pdf';
            }
            
            // Show success dialog with save option
            const dialogContent = document.createElement('div');
            dialogContent.innerHTML = `
              <p>PDFs combined successfully!</p>
              <p>Click "Save As" to download the combined PDF.</p>
            `;
            
            const dialog = document.createElement('div');
            dialog.className = 'dialog success-dialog';
            dialog.style.position = 'fixed';
            dialog.style.top = '0';
            dialog.style.left = '0';
            dialog.style.width = '100%';
            dialog.style.height = '100%';
            dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            dialog.style.display = 'flex';
            dialog.style.justifyContent = 'center';
            dialog.style.alignItems = 'center';
            dialog.style.zIndex = '3000';
            
            const dialogBox = document.createElement('div');
            dialogBox.style.backgroundColor = 'white';
            dialogBox.style.padding = '20px';
            dialogBox.style.borderRadius = '8px';
            dialogBox.style.maxWidth = '400px';
            dialogBox.style.textAlign = 'center';
            
            const title = document.createElement('h3');
            title.textContent = 'Success';
            title.style.color = '#4CAF50';
            title.style.marginTop = '0';
            
            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.justifyContent = 'center';
            buttonsContainer.style.gap = '10px';
            buttonsContainer.style.marginTop = '20px';
            
            const saveButton = document.createElement('button');
            saveButton.textContent = 'Save As';
            saveButton.style.padding = '10px 20px';
            saveButton.style.backgroundColor = '#4CAF50';
            saveButton.style.color = 'white';
            saveButton.style.border = 'none';
            saveButton.style.borderRadius = '4px';
            saveButton.style.cursor = 'pointer';
            saveButton.addEventListener('click', () => {
              if (e.detail.blob) {
                saveAs(e.detail.blob, filename);
              }
              document.body.removeChild(dialog);
            });
            
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.style.padding = '10px 20px';
            closeButton.style.backgroundColor = '#f5f5f5';
            closeButton.style.color = '#333';
            closeButton.style.border = 'none';
            closeButton.style.borderRadius = '4px';
            closeButton.style.cursor = 'pointer';
            closeButton.addEventListener('click', () => {
              document.body.removeChild(dialog);
            });
            
            buttonsContainer.appendChild(saveButton);
            buttonsContainer.appendChild(closeButton);
            
            dialogBox.appendChild(title);
            dialogBox.appendChild(dialogContent);
            dialogBox.appendChild(buttonsContainer);
            
            dialog.appendChild(dialogBox);
            document.body.appendChild(dialog);
          } else {
            showErrorDialog('Error', e.detail?.error || 'Failed to combine PDFs.');
          }
        });
      }

    // Function to save a blob with a filename
    function saveAs(blob, filename) {
        // For IE/Edge
        if (window.navigator.msSaveOrOpenBlob) {
          window.navigator.msSaveOrOpenBlob(blob, filename);
          return;
        }
        
        // For modern browsers
        // Create a temporary anchor element
        const a = document.createElement('a');
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
        
        // Set anchor properties
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        // Show a dialog to confirm the save location (this is browser-dependent)
        // Some browsers will show a save dialog automatically with the download attribute
        // Others might just download directly to the default location
        
        // Add to DOM and trigger click
        document.body.appendChild(a);
        
        // For some browsers, we need to use a timeout to ensure the save dialog appears
        setTimeout(() => {
          a.click();
          
          // Clean up
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 0);
      }
    
    // Add PDF function
    function addPdf() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/pdf';
        fileInput.multiple = true;
        
        fileInput.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files);
          if (files.length === 0) return;
          
          // Show progress overlay
          showProgressUI('Adding PDFs...', 'Reading files...');
          
          try {
            // Ensure PDF.js is loaded
            await loadPDFJS();
            
            // Process files in sequence
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              
              // Update progress
              updateProgress((i / files.length) * 100, `Processing ${file.name}...`);
              
              // Read file as ArrayBuffer
              const arrayBuffer = await readFileAsArrayBuffer(file);
              
              // Add to pdfFiles array
              pdfFiles.push({
                name: file.name,
                size: file.size,
                buffer: arrayBuffer,
                pageCount: await getPageCount(arrayBuffer)
              });
            }
            
            // Update UI
            updatePdfList();
            updateStats();
            
            // Enable combine button if we have PDFs
            if (pdfFiles.length > 0) {
              combinePdfButton.disabled = false;
              combinePdfButton.style.opacity = '1';
            }
            
            hideProgressUI();
          } catch (error) {
            console.error('Error adding PDFs:', error);
            hideProgressUI();
            showErrorDialog('Error', `Failed to add PDFs: ${error.message}`);
          }
        });
        
        fileInput.click();
      }
    
    // Read file as ArrayBuffer
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
    }
    
    // Get page count from PDF
    async function getPageCount(arrayBuffer) {
        try {
            // Ensure PDF.js is loaded
            await loadPDFJS();
            
            // Create a copy of the buffer to prevent detachment
            const bufferCopy = arrayBuffer.slice(0);
            const pdf = await window.pdfjsLib.getDocument({ data: bufferCopy }).promise;
            const pageCount = pdf.numPages;
            pdf.destroy();
            return pageCount;
        } catch (error) {
            console.error('Error getting page count:', error);
            return 0;
        }
    }
    
    // Update PDF list
    function updatePdfList() {
      // Clear the list container
      pdfListContainer.innerHTML = '';
      
      if (pdfFiles.length === 0) {
        // Show empty state
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
        return;
      }
      
      // Create PDF list
      const pdfList = document.createElement('div');
      pdfList.className = 'pdf-list';
      pdfList.style.display = 'flex';
      pdfList.style.flexDirection = 'column';
      pdfList.style.gap = '10px';
      
      // Add each PDF to the list
      pdfFiles.forEach((file, index) => {
        const pdfItem = document.createElement('div');
        pdfItem.className = 'pdf-item';
        pdfItem.style.display = 'flex';
        pdfItem.style.alignItems = 'center';
        pdfItem.style.padding = '10px';
        pdfItem.style.backgroundColor = '#f9f9f9';
        pdfItem.style.borderRadius = '4px';
        pdfItem.style.border = '1px solid #eee';
        pdfItem.style.cursor = 'pointer';
        pdfItem.style.transition = 'background-color 0.2s ease';
        
        // Add hover effect
        pdfItem.addEventListener('mouseover', () => {
          pdfItem.style.backgroundColor = '#f0f0f0';
        });
        pdfItem.addEventListener('mouseout', () => {
          pdfItem.style.backgroundColor = '#f9f9f9';
        });
        
        // Add click handler for preview
        pdfItem.addEventListener('click', () => {
          previewPdf(index);
        });
        
        // PDF icon
        const pdfIcon = document.createElement('div');
        pdfIcon.className = 'pdf-icon';
        pdfIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#e91e63" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#e91e63" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 15H15" stroke="#e91e63" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 11H15" stroke="#e91e63" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        pdfIcon.style.marginRight = '10px';
        
        // PDF info
        const pdfInfo = document.createElement('div');
        pdfInfo.className = 'pdf-info';
        pdfInfo.style.flex = '1';
        
        const pdfName = document.createElement('div');
        pdfName.className = 'pdf-name';
        pdfName.textContent = file.name;
        pdfName.style.fontWeight = '500';
        pdfName.style.marginBottom = '4px';
        
        const pdfDetails = document.createElement('div');
        pdfDetails.className = 'pdf-details';
        pdfDetails.textContent = `${formatFileSize(file.size)} • ${file.pageCount} pages`;
        pdfDetails.style.fontSize = '12px';
        pdfDetails.style.color = '#666';
        
        pdfInfo.appendChild(pdfName);
        pdfInfo.appendChild(pdfDetails);
        
        // PDF actions
        const pdfActions = document.createElement('div');
        pdfActions.className = 'pdf-actions';
        pdfActions.style.display = 'flex';
        pdfActions.style.gap = '5px';
        
        // Move up button
        if (index > 0) {
            const moveUpButton = document.createElement('button');
            moveUpButton.className = 'move-up-button';
            moveUpButton.innerHTML = '↑';
            moveUpButton.title = 'Move up';
            moveUpButton.style.border = 'none';
            moveUpButton.style.background = 'none';
            moveUpButton.style.cursor = 'pointer';
            moveUpButton.style.fontSize = '16px';
            moveUpButton.style.color = '#666';
            moveUpButton.style.padding = '5px';
            moveUpButton.addEventListener('click', (e) => {
              e.stopPropagation();
              movePdf(index, index - 1);
            });
            pdfActions.appendChild(moveUpButton);
          }
        
        // Move down button
        if (index < pdfFiles.length - 1) {
            const moveDownButton = document.createElement('button');
            moveDownButton.className = 'move-down-button';
            moveDownButton.innerHTML = '↓';
            moveDownButton.title = 'Move down';
            moveDownButton.style.border = 'none';
            moveDownButton.style.background = 'none';
            moveDownButton.style.cursor = 'pointer';
            moveDownButton.style.fontSize = '16px';
            moveDownButton.style.color = '#666';
            moveDownButton.style.padding = '5px';
            moveDownButton.addEventListener('click', (e) => {
              e.stopPropagation();
              movePdf(index, index + 1);
            });
            pdfActions.appendChild(moveDownButton);
          }
        
        // Remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.innerHTML = '✕';
        removeButton.title = 'Remove PDF';
        removeButton.style.border = 'none';
        removeButton.style.background = 'none';
        removeButton.style.cursor = 'pointer';
        removeButton.style.fontSize = '16px';
        removeButton.style.color = '#e91e63';
        removeButton.style.padding = '5px';
        removeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          removePdf(index);
        });
        pdfActions.appendChild(removeButton);
        
        // Assemble PDF item
        pdfItem.appendChild(pdfIcon);
        pdfItem.appendChild(pdfInfo);
        pdfItem.appendChild(pdfActions);
        
        pdfList.appendChild(pdfItem);
      });
      
      pdfListContainer.appendChild(pdfList);
    }
    
    // Move PDF in the list
    function movePdf(fromIndex, toIndex) {
      if (fromIndex < 0 || fromIndex >= pdfFiles.length || toIndex < 0 || toIndex >= pdfFiles.length) {
        return;
      }
      
      // Move the PDF in the array
      const pdf = pdfFiles.splice(fromIndex, 1)[0];
      pdfFiles.splice(toIndex, 0, pdf);
      
      // Update UI
      updatePdfList();
      
      // If the current preview is the moved PDF, update the preview
      if (currentPreviewFile === fromIndex) {
        currentPreviewFile = toIndex;
        previewPdf(toIndex);
      } else if (currentPreviewFile === toIndex) {
        // If we moved a PDF to the position of the current preview, adjust the index
        currentPreviewFile = fromIndex > toIndex ? toIndex + 1 : toIndex - 1;
      }
    }
    
    // Remove PDF from the list
    function removePdf(index) {
      if (index < 0 || index >= pdfFiles.length) {
        return;
      }
      
      // Remove the PDF from the array
      pdfFiles.splice(index, 1);
      
      // Update UI
      updatePdfList();
      updateStats();
      
      // If the current preview is the removed PDF, clear the preview
      if (currentPreviewFile === index) {
        clearPreview();
      } else if (currentPreviewFile > index) {
        // If we removed a PDF before the current preview, adjust the index
        currentPreviewFile--;
        previewPdf(currentPreviewFile);
      }
      
      // Disable combine button if no PDFs
      if (pdfFiles.length === 0) {
        combinePdfButton.disabled = true;
        combinePdfButton.style.opacity = '0.5';
      }
    }
    
    // Preview PDF
    function previewPdf(index) {
        if (index < 0 || index >= pdfFiles.length) {
          return;
        }
        
        // Set current preview file
        currentPreviewFile = index;
        currentPreviewPage = 1;
        
        // Get the PDF file
        const file = pdfFiles[index];
        
        // Get DOM elements
        const previewCanvas = document.getElementById('preview-canvas');
        const prevButton = document.querySelector('.prev-button');
        const nextButton = document.querySelector('.next-button');
        const pageInfo = document.querySelector('.preview-page-info');
        
        // Show navigation buttons if multiple pages
        if (file.pageCount > 1) {
          prevButton.style.display = 'block';
          nextButton.style.display = 'block';
          pageInfo.style.display = 'block';
          
          // Disable prev button on first page
          prevButton.disabled = currentPreviewPage === 1;
          prevButton.style.opacity = currentPreviewPage === 1 ? '0.5' : '1';
          
          // Disable next button on last page
          nextButton.disabled = currentPreviewPage === file.pageCount;
          nextButton.style.opacity = currentPreviewPage === file.pageCount ? '0.5' : '1';
          
          // Update page info
          pageInfo.textContent = `Page ${currentPreviewPage} of ${file.pageCount}`;
        } else {
          prevButton.style.display = 'none';
          nextButton.style.display = 'none';
          pageInfo.style.display = 'none';
        }
        
        // Create a copy of the buffer to prevent detachment
        const bufferCopy = file.buffer.slice(0);
        
        // Render the PDF
        renderPdfPreview(bufferCopy, currentPreviewPage, previewCanvas);
    }
    
    // Navigate preview
    function navigatePreview(direction) {
        if (currentPreviewFile === null) return;
        
        const file = pdfFiles[currentPreviewFile];
        const newPage = currentPreviewPage + direction;
        
        if (newPage < 1 || newPage > file.pageCount) return;
        
        currentPreviewPage = newPage;
        
        // Get DOM elements
        const previewCanvas = document.getElementById('preview-canvas');
        const prevButton = document.querySelector('.prev-button');
        const nextButton = document.querySelector('.next-button');
        const pageInfo = document.querySelector('.preview-page-info');
        
        // Update button states
        prevButton.disabled = currentPreviewPage === 1;
        prevButton.style.opacity = currentPreviewPage === 1 ? '0.5' : '1';
        
        nextButton.disabled = currentPreviewPage === file.pageCount;
        nextButton.style.opacity = currentPreviewPage === file.pageCount ? '0.5' : '1';
        
        // Update page info
        pageInfo.textContent = `Page ${currentPreviewPage} of ${file.pageCount}`;
        
        // Create a copy of the buffer to prevent detachment
        const bufferCopy = file.buffer.slice(0);
        
        // Render the PDF
        renderPdfPreview(bufferCopy, currentPreviewPage, previewCanvas);
    }
    
    // Clear preview
    function clearPreview() {
      currentPreviewFile = null;
      currentPreviewPage = 1;
      
      // Get DOM elements
      const previewCanvas = document.getElementById('preview-canvas');
      const prevButton = document.querySelector('.prev-button');
      const nextButton = document.querySelector('.next-button');
      const pageInfo = document.querySelector('.preview-page-info');
      
      // Clear canvas
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      
      // Hide navigation buttons
      prevButton.style.display = 'none';
      nextButton.style.display = 'none';
      pageInfo.style.display = 'none';
    }
    
    // Render PDF preview
    async function renderPdfPreview(buffer, pageNumber, canvas) {
        if (isRendering) {
          // Cancel any ongoing rendering
          if (renderingTask) {
            try {
              await renderingTask.cancel();
            } catch (error) {
              console.error('Error canceling rendering task:', error);
            }
          }
        }
        
        isRendering = true;
        
        try {
          // Load the PDF
          const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
          const pdf = await loadingTask.promise;
          
          // Get the page
          const page = await pdf.getPage(pageNumber);
          
          // Set scale to fit canvas
          const viewport = page.getViewport({ scale: 1 });
          
          // Maintain minimum canvas dimensions
          const minWidth = 440;  // Original width from initialization
          const minHeight = 572; // Original height from initialization
          
          // Calculate scale to fit within the minimum dimensions while preserving aspect ratio
          const scale = Math.min(
            minWidth / viewport.width,
            minHeight / viewport.height
          ) * 0.9; // 90% to add some margin
          
          const scaledViewport = page.getViewport({ scale });
          
          // Set canvas dimensions, ensuring they don't go below the minimum
          canvas.width = Math.max(scaledViewport.width, minWidth);
          canvas.height = Math.max(scaledViewport.height, minHeight);
          
          // Center the rendering on the canvas
          const offsetX = (canvas.width - scaledViewport.width) / 2;
          const offsetY = (canvas.height - scaledViewport.height) / 2;
          
          // Clear the entire canvas first
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff'; // White background
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Render the page
          const renderContext = {
            canvasContext: ctx,
            viewport: scaledViewport,
            transform: [1, 0, 0, 1, offsetX, offsetY] // Center the rendering
          };
          
          renderingTask = page.render(renderContext);
          await renderingTask.promise;
          
          // Clean up
          pdf.destroy();
          isRendering = false;
          renderingTask = null;
        } catch (error) {
          console.error('Error rendering PDF preview:', error);
          isRendering = false;
          renderingTask = null;
          
          // Show error on canvas
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = '14px Arial';
          ctx.fillStyle = 'red';
          ctx.textAlign = 'center';
          ctx.fillText('Error rendering PDF', canvas.width / 2, canvas.height / 2);
        }
    }
    
    // Update stats
    function updateStats() {
      const statsText = document.getElementById('pdf-stats-text');
      if (!statsText) return;
      
      if (pdfFiles.length === 0) {
        statsText.textContent = 'No PDFs added';
        return;
      }
      
      // Calculate total size and pages
      const totalSize = pdfFiles.reduce((sum, file) => sum + file.size, 0);
      const totalPages = pdfFiles.reduce((sum, file) => sum + file.pageCount, 0);
      
      statsText.textContent = `${pdfFiles.length} PDFs • ${formatFileSize(totalSize)} • ${totalPages} pages`;
    }
    
    // Format file size
    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
    
    // Combine PDFs
    async function combinePdfs() {
        if (pdfFiles.length === 0) {
          showErrorDialog('Error', 'No PDFs to combine. Please add at least one PDF.');
          return;
        }
        
        // Show progress overlay
        showProgressUI('Combining PDFs', 'Processing files...');
        
        try {
          // Load PDF.js library if not already loaded
          if (!window.pdfjsLib) {
            throw new Error('PDF.js library not loaded');
          }
          
          // Load PDF-lib for merging
          if (!window.PDFLib) {
            await loadPDFLib();
          }
          
          const { PDFDocument } = window.PDFLib;
          
          // Create a new PDF document
          const mergedPdf = await PDFDocument.create();
          
          // Process each PDF
          for (let i = 0; i < pdfFiles.length; i++) {
            const file = pdfFiles[i];
            
            // Update progress
            updateProgress((i / pdfFiles.length) * 100, `Processing ${file.name}...`);
            
            try {
              // Create a copy of the buffer to prevent detachment
              const bufferCopy = file.buffer.slice(0);
              
              // Load the PDF document
              const pdfDoc = await PDFDocument.load(bufferCopy);
              
              // Copy all pages
              const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
              
              // Add each page to the merged PDF
              for (const page of pages) {
                mergedPdf.addPage(page);
              }
            } catch (error) {
              console.error(`Error processing ${file.name}:`, error);
              throw new Error(`Failed to process ${file.name}: ${error.message}`);
            }
          }
          
          // Save the merged PDF
          updateProgress(90, 'Saving combined PDF...');
          const mergedPdfBytes = await mergedPdf.save();
          
          // Convert to Blob
          const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
          
          // Dispatch event for completion
          document.dispatchEvent(new CustomEvent('combine-complete', {
            detail: {
              success: true,
              blob: blob
            }
          }));
          
          updateProgress(100, 'Complete!');
        } catch (error) {
          console.error('Error combining PDFs:', error);
          hideProgressUI();
          showErrorDialog('Error', `Failed to combine PDFs: ${error.message}`);
          
          // Dispatch event for failure
          document.dispatchEvent(new CustomEvent('combine-complete', {
            detail: {
              success: false,
              error: error.message
            }
          }));
        }
    }
    
    // Load PDF-lib dynamically
    function loadPDFLib() {
        return new Promise((resolve, reject) => {
          if (window.PDFLib) {
            resolve();
            return;
          }
          
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load PDF-lib'));
          document.head.appendChild(script);
        });
      }


    function loadPDFJS() {
        return new Promise((resolve, reject) => {
          if (window.pdfjsLib) {
            // Set worker source if not already set
            if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
            }
            resolve();
            return;
          }
          
          // Load PDF.js main script
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
          script.onload = () => {
            // Set worker source
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
            resolve();
          };
          script.onerror = () => reject(new Error('Failed to load PDF.js'));
          document.head.appendChild(script);
        });
    }
    
    // Show progress UI
    function showProgressUI(title, message) {
      if (!progressOverlay) return;
      
      progressOverlay.style.display = 'flex';
      
      const progressTitle = progressOverlay.querySelector('.progress-title');
      if (progressTitle) {
        progressTitle.textContent = title || 'Processing...';
      }
      
      const progressMessage = progressOverlay.querySelector('.progress-message');
      if (progressMessage) {
        progressMessage.textContent = message || '';
      }
      
      const progressBarFill = progressOverlay.querySelector('.progress-bar-fill');
      if (progressBarFill) {
        progressBarFill.style.width = '0%';
      }
    }
    
    // Hide progress UI
    function hideProgressUI() {
      if (!progressOverlay) return;
      progressOverlay.style.display = 'none';
    }
    
    // Update progress
    function updateProgress(percent, message) {
      if (!progressOverlay) return;
      
      const progressBarFill = progressOverlay.querySelector('.progress-bar-fill');
      if (progressBarFill) {
        progressBarFill.style.width = `${percent}%`;
      }
      
      const progressMessage = progressOverlay.querySelector('.progress-message');
      if (progressMessage && message) {
        progressMessage.textContent = message;
      }
    }
    
    // Show error dialog
    function showErrorDialog(title, message) {
      // Create dialog if it doesn't exist
      let dialog = document.getElementById('error-dialog');
      if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'error-dialog';
        dialog.className = 'dialog error-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'white';
        dialog.style.padding = '20px';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
        dialog.style.zIndex = '3000';
        dialog.style.maxWidth = '400px';
        dialog.style.width = '90%';
        dialog.style.textAlign = 'center';
        
        document.body.appendChild(dialog);
      }
      
      // Set content
      dialog.innerHTML = `
        <h3 style="color: #e91e63; margin-top: 0;">${title || 'Error'}</h3>
        <p style="margin-bottom: 20px;">${message || 'An error occurred.'}</p>
        <button class="dialog-button" style="padding: 8px 16px; background-color: #e91e63; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
      `;
      
      // Add event listener to close button
      dialog.querySelector('.dialog-button').addEventListener('click', () => {
        dialog.style.display = 'none';
      });
      
      // Show dialog
      dialog.style.display = 'block';
    }
    
    // Show success dialog
    function showSuccessDialog(title, message) {
      // Create dialog if it doesn't exist
      let dialog = document.getElementById('success-dialog');
      if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'success-dialog';
        dialog.className = 'dialog success-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'white';
        dialog.style.padding = '20px';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
        dialog.style.zIndex = '3000';
        dialog.style.maxWidth = '400px';
        dialog.style.width = '90%';
        dialog.style.textAlign = 'center';
        
        document.body.appendChild(dialog);
      }
      
      // Set content
      dialog.innerHTML = `
        <h3 style="color: #4CAF50; margin-top: 0;">${title || 'Success'}</h3>
        <p style="margin-bottom: 20px;">${message || 'Operation completed successfully.'}</p>
        <button class="dialog-button" style="padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
      `;
      
      // Add event listener to close button
      dialog.querySelector('.dialog-button').addEventListener('click', () => {
        dialog.style.display = 'none';
      });
      
      // Show dialog
      dialog.style.display = 'block';
    }
    
    // Activate merge mode
    function activateMergeMode() {
      if (mergeContainer) {
        mergeContainer.style.display = 'flex';
        mergeContainer.style.flexDirection = 'column';
      } else {
        init();
      }
    }
    
    // Deactivate merge mode
    function deactivateMergeMode() {
      if (mergeContainer) {
        mergeContainer.style.display = 'none';
      }
    }

    
    
    
    // Public API
    return {
      init,
      activateMergeMode,
      deactivateMergeMode,
      addPdf,
      combinePdfs
    };
  })();
  
  // Initialize when the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    // Connect merge button to BrowserMergeTool
    const mergeButton = document.getElementById('merge-pdfs');
    if (mergeButton) {
      mergeButton.addEventListener('click', () => {
        console.log('Merge button clicked');
        if (window.BrowserMergeTool && typeof window.BrowserMergeTool.activateMergeMode === 'function') {
          window.BrowserMergeTool.activateMergeMode();
        } else {
          console.error('BrowserMergeTool not available or activateMergeMode is not a function');
          
          // Try to initialize BrowserMergeTool if it exists but wasn't initialized
          if (window.BrowserMergeTool && typeof window.BrowserMergeTool.init === 'function') {
            window.BrowserMergeTool.init();
            if (typeof window.BrowserMergeTool.activateMergeMode === 'function') {
              window.BrowserMergeTool.activateMergeMode();
            }
          } else {
            // Initialize if not available
            BrowserMergeTool.init();
            BrowserMergeTool.activateMergeMode();
          }
        }
      });
    }
  });
  
  // Expose to window object
  window.BrowserMergeTool = BrowserMergeTool;