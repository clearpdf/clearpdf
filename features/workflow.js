let PDFDocument;
try {
  // For Electron environment
  const { PDFDocument: PDFLib } = require('pdf-lib');
  PDFDocument = PDFLib;
} catch (error) {
  console.error('Error loading pdf-lib:', error);
  // Try to get it from window if available
  if (window.PDFLib && window.PDFLib.PDFDocument) {
    PDFDocument = window.PDFLib.PDFDocument;
  }
}

// PDF Workflow Tool
const WorkflowTool = {
    init() {
        // Add event listener to the workflow button
        const workflowButton = document.getElementById('workflow-tool');
        if (workflowButton) {
            workflowButton.addEventListener('click', this.openWorkflowWindow);
        }
    },

    openWorkflowWindow() {
        // Use Electron's IPC to open a new window
        if (window.electron) {
            window.electron.ipcRenderer.send('open-workflow-window');
        } else {
            // Fallback for browser testing
            window.open('pdf-workflow.html', '_blank', 'width=1200,height=800');
        }
    }
};

// Initialize the workflow tool when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    WorkflowTool.init();
});






    // PDF Workflow Application
    // document.addEventListener('DOMContentLoaded', function() {

        function initPdfWorkflow() {
        // State Management
        const appState = {
            pdfs: [],
            selectedPages: new Set(),
            actionMode: 'idle',
            selectedPdfsForCombine: [],
            history: {
                past: [],
                future: []
            }
        };
        
        // DOM Elements
        const pdfWorkspace = document.getElementById('pdf-workspace');
        const uploadPdfBtn = document.getElementById('upload-pdf-btn');
        // Add undo/redo buttons
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const rotateClockwiseBtn = document.getElementById('rotate-cw-btn');
        
        const rotateCounterclockwiseBtn = document.getElementById('rotate-ccw-btn');
        const deletePagesBtn = document.getElementById('delete-pages-btn');
        const newPdfBtn = document.getElementById('new-pdf-btn');
        const combinePdfsBtn = document.getElementById('combine-pdfs-btn');
        const cancelBtn = document.getElementById('cancel-btn');
        // const previewBtn = document.getElementById('preview-btn');
        const selectedCountEl = document.getElementById('selected-count');
        const combineModal = document.getElementById('combine-modal');
        const combinePdfList = document.getElementById('combine-pdf-list');
        const closeCombineModal = document.getElementById('close-combine-modal');
        const cancelCombine = document.getElementById('cancel-combine');
        const confirmCombine = document.getElementById('confirm-combine');
        
        // Enable the New PDF button regardless of its initial state
        if (newPdfBtn) {
          newPdfBtn.disabled = false;
          newPdfBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          // Make sure we only have one event listener
          newPdfBtn.removeEventListener('click', handleGroupSelectedPages); // Remove any existing listeners
          newPdfBtn.addEventListener('click', handleGroupSelectedPages);    // Add a single listener
        }

        // Utility Functions
        function generateId() {
          return Math.random().toString(36).substring(2, 11);
        }
        
        function showToast(message, type = 'info', duration = 3000) {
          const toast = document.createElement('div');
          toast.className = `toast ${type}`;
          toast.textContent = message;
          
          document.getElementById('toast-container').appendChild(toast);
          
          setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
              toast.remove();
            }, 300);
          }, duration);
        }



        
        
        function updateButtonStates() {
          // Update the state of action buttons based on selection
          const hasSelection = appState.selectedPages.size > 0;
          
          // Show/hide action buttons based on selection
          document.querySelectorAll('.action-btn').forEach(btn => {
            // Skip disabling the new PDF button - it should always be enabled
            if (btn.id !== 'new-pdf-btn') {
              btn.disabled = !hasSelection;
              btn.classList.toggle('opacity-50', !hasSelection);
              btn.classList.toggle('cursor-not-allowed', !hasSelection);
            }
          });
          
          // Update the visibility of Delete Selected buttons
          appState.pdfs.forEach(pdf => {
            const hasSelectedPages = pdf.pages.some(page => page.selected);
            const deleteSelectedBtn = document.querySelector(`.delete-selected-btn[data-doc-id="${pdf.id}"]`);
            
            if (deleteSelectedBtn) {
              if (hasSelectedPages) {
                deleteSelectedBtn.classList.remove('hidden');
              } else {
                deleteSelectedBtn.classList.add('hidden');
              }
            }
          });
        }

        function showCustomAlert(title, message, onConfirm, onCancel) {
  const alertBox = document.getElementById('custom-alert');
  const alertTitle = document.getElementById('alert-title');
  const alertMessage = document.getElementById('alert-message');
  const confirmBtn = document.getElementById('alert-confirm');
  const cancelBtn = document.getElementById('alert-cancel');
  
  // Set the alert content
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  
  // Show the alert
  alertBox.classList.remove('hidden');
  
  // Set up the event handlers
  const handleConfirm = () => {
    alertBox.classList.add('hidden');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    if (onConfirm) onConfirm();
  };
  
  const handleCancel = () => {
    alertBox.classList.add('hidden');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    if (onCancel) onCancel();
  };
  
  // Add event listeners
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}
        
        function updateConfirmCombineButton() {
          confirmCombine.disabled = appState.selectedPdfsForCombine.length < 2;
          if (appState.selectedPdfsForCombine.length > 0) {
            confirmCombine.textContent = `Combine ${appState.selectedPdfsForCombine.length} PDFs`;
          } else {
            confirmCombine.textContent = 'Combine PDFs';
          }
        }
        
        // PDF Generation Functions (Mocks)
        function createSamplePdf(name, pageCount) {
          const pages = [];
          for (let i = 1; i <= pageCount; i++) {
            pages.push({
              id: generateId(),
              pageNumber: i,
              imageUrl: `data:image/svg+xml,%3Csvg width='300' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='24' fill='%23666' text-anchor='middle' dy='.3em'%3EPDF Page ${Math.floor(Math.random() * 100)}%3C/text%3E%3C/svg%3E`,
              selected: false,
              rotation: 0
            });
          }
          
          return {
            id: generateId(),
            name,
            pages
          };
        }
        
        function addSamplePdfs() {
          // Initialize with an empty array instead of sample PDFs
          appState.pdfs = [];
          renderPdfs();
        }
        
        
        function handleDeletePdf(pdfId) {
          // Save state before making changes
          saveState();
          
          // Find the PDF index
          const pdfIndex = appState.pdfs.findIndex(pdf => pdf.id === pdfId);
          
          if (pdfIndex === -1) {
            showToast('PDF not found', 'error');
            return;
          }
          
          // Get the PDF name for the toast message
          const pdfName = appState.pdfs[pdfIndex].name;
          
          // Check if the PDF has pages
          const hasPages = appState.pdfs[pdfIndex].pages && appState.pdfs[pdfIndex].pages.length > 0;
          
          // If PDF has no pages, delete it directly without confirmation
          if (!hasPages) {
            // Remove the PDF from the array
            appState.pdfs.splice(pdfIndex, 1);
            
            // Update UI
            renderPdfs();
            updateButtonStates();
            showToast(`"${pdfName}" deleted`, 'success');
            return;
          }
          
          // For PDFs with pages, show confirmation dialog
          showCustomAlert(
            'Confirm Delete',
            `Are you sure you want to delete "${pdfName}"?`,
            () => {
              // Save state before making changes
              saveState();
              
              // Remove any selected pages from this PDF
              appState.pdfs[pdfIndex].pages.forEach(page => {
                appState.selectedPages.delete(page.id);
              });
              
              // Remove the PDF from the array
              appState.pdfs.splice(pdfIndex, 1);
              
              // Update UI
              renderPdfs();
              updateButtonStates();
              showToast(`"${pdfName}" deleted`, 'success');
            },
            () => {
              // User canceled the operation
              showToast('Delete operation canceled', 'info');
            }
          );
        }


        function exportPdfs() {
          // This function handles the actual PDF export with save dialogs
          
          if (window.electron) {
            // Use Electron's API to export PDFs with save dialogs
            appState.pdfs.forEach(pdf => {
              // Make sure we have a valid default filename
              const defaultFileName = pdf.name || `PDF_${pdf.id}.pdf`;
              
              // For each PDF, send a request to the main process to show a save dialog
              window.electron.ipcRenderer.send('save-pdf', {
                pdfData: pdf,
                defaultPath: defaultFileName
              });
            });
            
            // Listen for save results
            window.electron.ipcRenderer.once('save-pdf-result', (event, result) => {
              if (result.success) {
                showToast(`PDF saved successfully: ${result.fileName}`, 'success');
              } else {
                showToast(`Failed to save PDF: ${result.error}`, 'error');
              }
            });
          } else {
            // Fallback for browser testing - simulate saving with a mock dialog
            simulateSaveDialog();
          }
        }


        function simulateSaveDialog() {
          // This is a mock function for browser testing
          let savedCount = 0;
          
          appState.pdfs.forEach((pdf, index) => {
            // Simulate a delay between saves
            setTimeout(() => {
              savedCount++;
              showToast(`Saved "${pdf.name}" successfully`, 'success');
              
              if (savedCount === appState.pdfs.length) {
                showToast('All PDFs exported successfully', 'success');
              }
            }, index * 1000);
          });
        }

        function arrayBufferToBase64(buffer) {
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          
          return btoa(binary);
        }


        async function handleExportPdfs() {
          if (appState.pdfs.length === 0) {
            showToast('No PDFs to export', 'error');
            return;
          }
          
          // Show loading indicator
          showToast('Preparing PDF for export...', 'info');
          
          // For each PDF in the state, export it
          for (const pdf of appState.pdfs) {
            try {
              let pdfBytes;
              
              console.log(`Processing PDF "${pdf.name}" for export`);
              console.log(`Original PDF bytes length: ${pdf.originalPdfBytes ? pdf.originalPdfBytes.length : 'N/A'} bytes`);
              
              // IMPORTANT: Use the original PDF bytes directly if available and not modified
              if (pdf.originalPdfBytes && !hasBeenModified(pdf)) {
                console.log(`PDF "${pdf.name}" has not been modified, using original bytes directly`);
                pdfBytes = pdf.originalPdfBytes;
              } else if (pdf.originalPdfBytes) {
                console.log(`PDF "${pdf.name}" has been modified, processing with high quality preservation`);
                
                // For modified PDFs, we need to use pdf-lib but with careful settings to preserve quality
                try {
                  // Load the original PDF document with settings to preserve quality
                  const pdfDoc = await PDFDocument.load(pdf.originalPdfBytes, {
                    ignoreEncryption: true,
                    updateMetadata: false
                    // Removed the problematic ParseSpeeds.Slow option
                  });
                  
                  // Store references to all original pages
                  const pageCount = pdfDoc.getPageCount();
                  console.log(`Original PDF has ${pageCount} pages`);
                  const originalPages = [];
                  
                  for (let i = 0; i < pageCount; i++) {
                    originalPages.push(pdfDoc.getPage(i));
                  }
                  
                  // Remove all pages from the document (in reverse order to avoid index shifting)
                  for (let i = pageCount - 1; i >= 0; i--) {
                    pdfDoc.removePage(i);
                  }
                  
                  // Add pages back in the desired order with any rotations
                  for (const page of pdf.pages) {
                    if (page.originalPageIndex !== undefined && page.originalPageIndex < originalPages.length) {
                      // Add the original page back to the document
                      const originalPage = originalPages[page.originalPageIndex];
                      pdfDoc.addPage(originalPage);
                      
                      // Apply rotation if needed
                      if (page.rotation) {
                        const addedPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
                        // Fix: Use the correct rotation format with type and angle
                        addedPage.setRotation({
                          type: 'degrees',
                          angle: page.rotation
                        });
                      }
                    }
                  }
                  
                  // Save with maximum quality preservation settings
                  pdfBytes = await pdfDoc.save({
                    useObjectStreams: false,
                    addDefaultPage: false,
                    preservePDFForm: true,
                    updateMetadata: false,
                    preserveEditability: true // Add this to preserve text properties
                  });
                  
                  console.log(`Modified PDF processed, new size: ${pdfBytes.length} bytes`);
                } catch (error) {
                  console.error(`Error processing modified PDF "${pdf.name}":`, error);
                  // Fallback to original bytes if processing fails
                  pdfBytes = pdf.originalPdfBytes;
                  console.log(`Falling back to original bytes: ${pdfBytes.length} bytes`);
                }
              } else {
                // Fallback for PDFs without valid original bytes - create with high quality
                console.log(`No valid original bytes for PDF "${pdf.name}", creating new high-quality PDF`);
                
                // Create a new PDF document
                const newPdfDoc = await PDFDocument.create();
                
                // Add each page with high quality settings
                for (const page of pdf.pages) {
                  // Create a new page with the same dimensions
                  const newPage = newPdfDoc.addPage([page.width || 595, page.height || 842]);
                  
                  // Apply rotation if needed
                  if (page.rotation) {
                    newPage.setRotation({
                      type: 'degrees',
                      angle: page.rotation
                    });
                  }
                  
                  // If we have page content as an image, embed it with high quality
                  if (page.imageUrl) {
                    try {
                      // Extract the image data from the imageUrl
                      const imageData = page.imageUrl.split(',')[1];
                      if (imageData) {
                        // Convert base64 to Uint8Array
                        const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
                        
                        // Embed the image in the PDF with high quality
                        let image;
                        if (page.imageUrl.includes('image/png')) {
                          image = await newPdfDoc.embedPng(imageBytes);
                        } else if (page.imageUrl.includes('image/jpeg')) {
                          image = await newPdfDoc.embedJpg(imageBytes);
                        } else {
                          // Default to PNG for better quality
                          image = await newPdfDoc.embedPng(imageBytes);
                        }
                        
                        // Draw the image on the page at full quality
                        newPage.drawImage(image, {
                          x: 0,
                          y: 0,
                          width: page.width || image.width,
                          height: page.height || image.height
                        });
                      }
                    } catch (imageError) {
                      console.error(`Error embedding image for page ${page.pageNumber}:`, imageError);
                    }
                  }
                }
                
                // Save with high quality settings
                pdfBytes = await newPdfDoc.save({
                  useObjectStreams: false,
                  addDefaultPage: false,
                  preservePDFForm: true,
                  updateMetadata: false
                });
                
                console.log(`Created new PDF, size: ${pdfBytes.length} bytes`);
              }
              
              // Make sure we have a valid default filename
              const defaultFileName = pdf.name || `PDF_${pdf.id}.pdf`;
              
              // For each PDF, send a request to the main process to show a save dialog
              if (window.electron) {
                console.log(`Sending PDF to main process for export, size: ${pdfBytes.length} bytes`);
                
                // Convert to base64 for maximum quality preservation
                const base64Data = arrayBufferToBase64(pdfBytes);
                console.log(`Converted to base64 format for quality preservation, length: ${base64Data.length}`);
                
                window.electron.ipcRenderer.send('export-pdf', {
                  pdfData: base64Data,
                  fileName: defaultFileName,
                  encoding: 'base64' // Specify that we're using base64 encoding
                });
                
                // Listen for save results
                window.electron.ipcRenderer.once('export-pdf-result', (event, result) => {
                  if (result.success) {
                    showToast(`PDF saved successfully: ${result.fileName || defaultFileName} (${formatFileSize(result.fileSize)})`, 'success');
                    console.log(`Exported file size: ${result.fileSize} bytes`);
                  } else {
                    showToast(`Failed to save PDF: ${result.error}`, 'error');
                  }
                });
              } else {
                // Fallback for browser testing
                simulateSaveDialog(pdf.name);
              }
            } catch (error) {
              console.error(`Error exporting PDF "${pdf.name}":`, error);
              showToast(`Error exporting PDF "${pdf.name}": ${error.message}`, 'error');
            }
          }
        }


        function performExport() {
          // This function would handle the actual PDF export
          // In a real implementation, this would use Electron's dialog to save files
          
          if (window.electron) {
            // Use Electron's API to export PDFs
            window.electron.ipcRenderer.send('export-pdfs', appState.pdfs);
            showToast('Exporting PDFs...', 'info');
          } else {
            // Fallback for browser testing - just show a success message
            showToast(`${appState.pdfs.length} PDF(s) exported successfully`, 'success');
          }
        }
        
        // Add this function to your workflow.js file

        function handleRotatePage(pageId, documentId, clockwise) {
          saveState();
          
          const pdf = appState.pdfs.find(p => p.id === documentId);
          if (!pdf) return;
          
          const page = pdf.pages.find(p => p.id === pageId);
          if (!page) return;
          
          // Update rotation (add or subtract 90 degrees)
          page.rotation = ((page.rotation || 0) + (clockwise ? 90 : -90)) % 360;
          
          // Ensure rotation is always positive
          if (page.rotation < 0) {
            page.rotation += 360;
          }
          
          renderPdfs();
          showToast(`Page rotated ${clockwise ? 'clockwise' : 'counter-clockwise'}`, 'success');
        }

        // Also add the function to handle rotating multiple selected pages
        function handleRotateSelectedPages(clockwise) {
          if (appState.selectedPages.size === 0) {
            showToast('No pages selected for rotation', 'error');
            return;
          }
          
          saveState();
          
          // Rotate all selected pages
          appState.pdfs.forEach(pdf => {
            pdf.pages.forEach(page => {
              if (appState.selectedPages.has(page.id)) {
                // Update rotation (add or subtract 90 degrees)
                page.rotation = ((page.rotation || 0) + (clockwise ? 90 : -90)) % 360;
                
                // Ensure rotation is always positive
                if (page.rotation < 0) {
                  page.rotation += 360;
                }
              }
            });
          });
          
          renderPdfs();
          showToast(`${appState.selectedPages.size} page(s) rotated ${clockwise ? 'clockwise' : 'counter-clockwise'}`, 'success');
        }
        
        
        function handleGroupSelectedPages() {
          if (appState.selectedPages.size === 0) {
            // If no pages are selected, create a new empty PDF
            createEmptyPdf();
            return;
          }
          
          // Save state before making changes
          saveState();
          
          // Collect all selected pages across PDFs
          const selectedPages = [];
          
          appState.pdfs.forEach(pdf => {
            pdf.pages.forEach(page => {
              if (appState.selectedPages.has(page.id)) {
                // Create a deep copy of the page to preserve all properties
                const pageCopy = JSON.parse(JSON.stringify(page));
                selectedPages.push({ 
                  ...pageCopy, 
                  originalDocId: pdf.id 
                });
              }
            });
          });
          
          // Create a new PDF with selected pages
          const newPdf = {
            id: generateId(),
            name: `New PDF ${appState.pdfs.length + 1}.pdf`,
            pages: selectedPages.map((page, idx) => ({
              ...page,
              id: generateId(), // New ID for the page in the new PDF
              selected: false,
              pageNumber: idx + 1
            }))
          };
          
          // Remove selected pages from original PDFs
          appState.pdfs.forEach((pdf, pdfIndex) => {
            pdf.pages = pdf.pages.filter(page => !appState.selectedPages.has(page.id));
            
            // Update page numbers
            pdf.pages.forEach((page, idx) => {
              page.pageNumber = idx + 1;
            });
          });
          
          // Remove empty PDFs
          appState.pdfs = appState.pdfs.filter(pdf => pdf.pages.length > 0);
          
          // Add new PDF
          appState.pdfs.push(newPdf);
          
          // Clear selected pages
          appState.selectedPages.clear();
          
          renderPdfs();
          updateButtonStates();
          showToast('New PDF created from selected pages', 'success');
        }

        function createEmptyPdf() {
          // Save state before making changes
          saveState();
          
          // Create a new empty PDF
          const newPdf = {
            id: generateId(),
            name: `New PDF.pdf`,
            pages: []
          };
          
          // Add new PDF to the list
          appState.pdfs.push(newPdf);
          
          // Update UI
          renderPdfs();
          updateButtonStates();
          showToast('New empty PDF created', 'success');
        }
        
        function handleReorderPage(sourceDocId, sourcePageId, targetDocId, targetIndex) {
          saveState();
          
          // Find source and target PDFs
          const sourcePdfIndex = appState.pdfs.findIndex(p => p.id === sourceDocId);
          const targetPdfIndex = appState.pdfs.findIndex(p => p.id === targetDocId);
          
          if (sourcePdfIndex === -1 || targetPdfIndex === -1) return;
          
          const sourcePdf = appState.pdfs[sourcePdfIndex];
          const targetPdf = appState.pdfs[targetPdfIndex];
          
          // Find the page in the source PDF
          const sourcePageIndex = sourcePdf.pages.findIndex(p => p.id === sourcePageId);
          if (sourcePageIndex === -1) return;
          
          // Get the page object with a deep copy to preserve all properties
          const page = JSON.parse(JSON.stringify(sourcePdf.pages[sourcePageIndex]));
          
          // Remove page from source PDF
          sourcePdf.pages.splice(sourcePageIndex, 1);
          
          // If source PDF is now empty, remove it
          if (sourcePdf.pages.length === 0) {
            appState.pdfs.splice(sourcePdfIndex, 1);
          } else {
            // Update page numbers for source PDF
            sourcePdf.pages.forEach((p, idx) => {
              p.pageNumber = idx + 1;
            });
          }
          
          // Add page to target PDF at specified index
          const newPage = {
            ...page,
            id: generateId(), // Generate a new ID for the page
            selected: false,  // Reset selection state
            pageNumber: targetIndex + 1
          };
          
          // Ensure we preserve the imageUrl when moving the page
          if (!newPage.imageUrl && page.imageUrl) {
            newPage.imageUrl = page.imageUrl;
          }
          
          targetPdf.pages.splice(targetIndex, 0, newPage);
          
          // Update page numbers for target PDF
          targetPdf.pages.forEach((p, idx) => {
            p.pageNumber = idx + 1;
          });
          
          // Update UI
          renderPdfs();
          updateButtonStates();
        }
        
        function openCombineModal() {
          // Populate the modal with the list of PDFs
          combinePdfList.innerHTML = '';
          appState.selectedPdfsForCombine = [];
          
          // Check if we have PDFs to combine
          if (appState.pdfs.length < 2) {
            combinePdfList.innerHTML = '<div class="p-4 text-center text-gray-500">You need at least 2 PDFs to combine</div>';
            confirmCombine.disabled = true;
            combineModal.classList.remove('hidden');
            return;
          }
          
          appState.pdfs.forEach(pdf => {
            const pdfItem = document.createElement('div');
            pdfItem.className = 'p-2 rounded flex items-center justify-between cursor-pointer border border-gray-200 hover:bg-gray-50';
            pdfItem.dataset.pdfId = pdf.id;
            
            pdfItem.innerHTML = `
              <div class="flex items-center">
                <span class="text-sm font-medium">${pdf.name}</span>
                <span class="text-xs text-gray-500 ml-2">(${pdf.pages.length} pages)</span>
              </div>
              <i class="fas fa-check text-purple-600 hidden"></i>
            `;
            
            pdfItem.addEventListener('click', () => togglePdfSelection(pdf.id, pdfItem));
            
            combinePdfList.appendChild(pdfItem);
          });
          
          updateConfirmCombineButton();
          combineModal.classList.remove('hidden');
        }
        
        function togglePdfSelection(pdfId, element) {
          const index = appState.selectedPdfsForCombine.indexOf(pdfId);
          
          if (index === -1) {
            appState.selectedPdfsForCombine.push(pdfId);
            element.classList.add('border-purple-500', 'bg-purple-50');
            element.querySelector('.fa-check').classList.remove('hidden');
          } else {
            appState.selectedPdfsForCombine.splice(index, 1);
            element.classList.remove('border-purple-500', 'bg-purple-50');
            element.querySelector('.fa-check').classList.add('hidden');
          }
          
          updateConfirmCombineButton();
        }
        
        async function handleCombinePdfs() {
          if (appState.selectedPdfsForCombine.length < 2) {
            showToast('Please select at least 2 PDFs to combine', 'error');
            return;
          }
          
          saveState();
          
          try {
            // Create a new PDF document
            const newPdfDoc = await PDFDocument.create();
            
            // Create arrays to store combined pages and PDFs to remove
            const combinedPages = [];
            const pdfIdsToRemove = [...appState.selectedPdfsForCombine];
            
            // Get selected PDFs
            const selectedPdfs = appState.pdfs.filter(pdf => appState.selectedPdfsForCombine.includes(pdf.id));
            
            // Validate each PDF's bytes before proceeding
            const pdfValidationResults = await Promise.all(
              selectedPdfs.map(async pdf => {
                console.log(`Validating PDF: ${pdf.name}`, pdf.originalPdfBytes ? `Bytes length: ${pdf.originalPdfBytes.length}` : 'No bytes available');
                
                if (!pdf.originalPdfBytes) {
                  console.log(`PDF "${pdf.name}" has no original bytes`);
                  return { pdf, isValid: false, isImageBased: false };
                }
                
                try {
                  // Check if this is an image-based PDF (created from an image)
                  const isImageBased = pdf.name.match(/\.(jpe?g|png|gif|bmp|tiff?)$/i) !== null;
                  const isValid = await isPdfValid(pdf.originalPdfBytes);
                  console.log(`PDF "${pdf.name}" validation result:`, isValid, `Image-based: ${isImageBased}`);
                  return { pdf, isValid, isImageBased };
                } catch (error) {
                  console.error(`Error during validation of "${pdf.name}":`, error);
                  return { pdf, isValid: false, isImageBased: false };
                }
              })
            );
            
            let pageIndex = 0;
            
            // Process each PDF individually based on its validation result
            for (const result of pdfValidationResults) {
              const pdf = result.pdf;
              
              if (result.isValid) {
                try {
                  console.log(`Processing PDF "${pdf.name}" with high-quality approach`);
                  
                  // For image-based PDFs, we need to handle them differently
                  if (result.isImageBased) {
                    console.log(`PDF "${pdf.name}" is image-based, adding as a whole document`);
                    
                    // Load the PDF document
                    const sourcePdf = await PDFDocument.load(pdf.originalPdfBytes);
                    const pageCount = sourcePdf.getPageCount();
                    
                    // Copy all pages from the source PDF
                    for (let i = 0; i < pageCount; i++) {
                      try {
                        // Copy the page
                        const [copiedPage] = await newPdfDoc.copyPages(sourcePdf, [i]);
                        newPdfDoc.addPage(copiedPage);
                        
                        // Add to the combined pages array
                        const pageData = pdf.pages[i] || pdf.pages[0]; // Fallback to first page if index doesn't exist
                        combinedPages.push({
                          ...JSON.parse(JSON.stringify(pageData)),
                          id: generateId(),
                          selected: false,
                          pageNumber: ++pageIndex,
                          originalPageIndex: pageIndex - 1
                        });
                      } catch (pageError) {
                        console.error(`Error copying page ${i} from image-based PDF "${pdf.name}":`, pageError);
                      }
                    }
                  } else {
                    // Regular PDF - copy pages normally with high quality preservation
                    const sourcePdf = await PDFDocument.load(pdf.originalPdfBytes, {
                      ignoreEncryption: true,
                      updateMetadata: false,
                      parseSpeed: PDFDocument.ParseSpeeds.Slow // Use slow parsing for better quality
                    });
                    
                    // Copy all pages from the source PDF
                    const pageIndices = Array.from({ length: sourcePdf.getPageCount() }, (_, i) => i);
                    const copiedPages = await newPdfDoc.copyPages(sourcePdf, pageIndices);
                    
                    // Add all copied pages to the new document
                    copiedPages.forEach((copiedPage, idx) => {
                      newPdfDoc.addPage(copiedPage);
                      
                      // Apply rotation if needed
                      if (pdf.pages[idx] && pdf.pages[idx].rotation) {
                        const addedPage = newPdfDoc.getPage(newPdfDoc.getPageCount() - 1);
                        addedPage.setRotation({
                          type: 'degrees',
                          angle: pdf.pages[idx].rotation
                        });
                      }
                      
                      // Add to the combined pages array (use existing page data if available)
                      const pageData = idx < pdf.pages.length ? pdf.pages[idx] : {
                        id: generateId(),
                        pageNumber: idx + 1,
                        selected: false,
                        rotation: 0,
                        originalPageIndex: idx
                      };
                      
                      combinedPages.push({
                        ...JSON.parse(JSON.stringify(pageData)),
                        id: generateId(),
                        selected: false,
                        pageNumber: ++pageIndex,
                        originalPageIndex: pageIndex - 1
                      });
                    });
                  }
                  
                  console.log(`Successfully added high-quality pages from ${pdf.name}`);
                } catch (error) {
                  console.error(`Error processing PDF with original bytes: ${pdf.name}`, error);
                  // If high-quality approach fails, try base64 preservation approach
                  await processImageBasedPdf(pdf, newPdfDoc, combinedPages, pageIndex);
                  pageIndex = combinedPages.length;
                }
              } else {
                // For PDFs without valid original bytes, use base64 preservation approach
                console.log(`Using base64 preservation approach for "${pdf.name}" due to missing or invalid PDF data`);
                await processImageBasedPdf(pdf, newPdfDoc, combinedPages, pageIndex);
                pageIndex = combinedPages.length;
              }
            }
            
            if (combinedPages.length === 0) {
              showToast('No valid pages could be combined. Operation canceled.', 'error');
              return;
            }
            
            // Save the combined PDF bytes with high quality settings
            const combinedPdfBytes = await newPdfDoc.save({
              useObjectStreams: false,
              addDefaultPage: false,
              preservePDFForm: true,
              updateMetadata: false,
              preserveEditability: true // Add this to preserve text properties
            });
            
            // Convert to base64 for maximum quality preservation
            const base64PdfData = arrayBufferToBase64(combinedPdfBytes);
            
            // Create the combined PDF object
            const combinedPdf = {
              id: generateId(),
              name: `Combined PDF.pdf`,
              pages: combinedPages.map((page, idx) => ({
                ...page,
                pageNumber: idx + 1,
                originalPageIndex: idx
              })),
              originalPdfBytes: combinedPdfBytes,
              base64PdfData: base64PdfData // Store base64 version for export
            };
            
            // Remove the original PDFs
            appState.pdfs = appState.pdfs.filter(pdf => !pdfIdsToRemove.includes(pdf.id));
            
            // Add the combined PDF
            appState.pdfs.push(combinedPdf);
            
            // Close the modal
            combineModal.classList.add('hidden');
            
            // Update UI
            renderPdfs();
            updateButtonStates();
            
            showToast('PDFs combined successfully with high quality preservation', 'success');
          } catch (error) {
            console.error('Error combining PDFs:', error);
            showToast(`Error combining PDFs: ${error.message}`, 'error');
          }
        }
        


async function processImageBasedPdf(pdf, newPdfDoc, combinedPages, startPageIndex) {
  let pageIndex = startPageIndex;
  let pagesAdded = 0;
  
  console.log(`Processing "${pdf.name}" using image-based approach with base64 preservation`);
  
  for (const page of pdf.pages) {
    if (page.imageUrl) {
      try {
        // Extract the image data from the imageUrl (already in base64 format)
        const imageData = page.imageUrl.split(',')[1];
        if (imageData) {
          // Convert base64 to Uint8Array
          const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
          
          // Embed the image in the PDF with high quality preservation
          let image;
          if (page.imageUrl.includes('image/png')) {
            image = await newPdfDoc.embedPng(imageBytes);
          } else if (page.imageUrl.includes('image/jpeg')) {
            image = await newPdfDoc.embedJpg(imageBytes);
          } else {
            // Default to PNG for better quality
            image = await newPdfDoc.embedPng(imageBytes);
          }
          
          // Calculate dimensions - use stored dimensions if available
          const width = page.width || image.width;
          const height = page.height || image.height;
          
          // Add a page with the image at maximum quality
          const newPage = newPdfDoc.addPage([width, height]);
          
          // Draw the image on the page with full quality
          newPage.drawImage(image, {
            x: 0,
            y: 0,
            width: width,
            height: height,
          });
          
          // Apply rotation if needed
          if (page.rotation) {
            newPage.setRotation({
              type: 'degrees',
              angle: page.rotation
            });
          }
          
          // Add to the combined pages array
          combinedPages.push({
            ...JSON.parse(JSON.stringify(page)),
            id: generateId(),
            selected: false,
            pageNumber: ++pageIndex,
            originalPageIndex: pageIndex - 1
          });
          
          pagesAdded++;
          console.log(`Successfully added base64-preserved page from ${pdf.name}`);
        }
      } catch (imageError) {
        console.error('Error processing image for page:', imageError);
      }
    }
  }
  
  if (pagesAdded === 0) {
    console.warn(`No pages could be added from "${pdf.name}" using base64 preservation approach`);
  } else {
    console.log(`Added ${pagesAdded} pages from "${pdf.name}" using base64 preservation approach`);
  }
  
  return pageIndex;
}



        function handleCancelSelection() {
          // Clear all selections
          appState.pdfs.forEach(pdf => {
            pdf.pages.forEach(page => {
              page.selected = false;
            });
          });
          
          appState.selectedPages.clear();
          appState.actionMode = 'idle';
          
          renderPdfs();
          updateButtonStates();
        }
        
        function handlePreview() {
          showToast('Preview feature coming soon', 'info');
        }
        

// Update the file upload handler to properly handle images and PDFs
function handleUpload() {
  // Create a file input element
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.pdf,.jpg,.jpeg,.png';
  
  // Listen for file selection
  fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    
    if (!files || files.length === 0) {
      return;
    }
    
    // Save state before making changes
    saveState();
    
    // Show loading toast
    showToast(`Processing ${files.length} file(s)...`, 'info');
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      const fileType = file.type;
      
      try {
        // Create a new PDF object
        let newPdf;
        
        if (fileType.includes('pdf')) {
          // Handle PDF file
          const arrayBuffer = await file.arrayBuffer();
          
          try {
            // Store the original PDF bytes for later use
            const originalPdfBytes = new Uint8Array(arrayBuffer);
            
            // Convert to base64 for maximum quality preservation
            const base64PdfData = arrayBufferToBase64(originalPdfBytes);
            
            // Basic validation check
            if (originalPdfBytes.length < 5) {
              console.warn(`PDF "${fileName}" has insufficient data (${originalPdfBytes.length} bytes)`);
              showToast(`Warning: "${fileName}" appears to be empty or corrupted`, 'warning');
            }
            
            // Use PDF.js to render thumbnails of the PDF pages
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            const numPages = pdf.numPages;
            const pages = [];
            
            // Process each page with high quality settings
            for (let i = 1; i <= numPages; i++) {
              const page = await pdf.getPage(i);
              // Use higher scale for better quality thumbnails
              const viewport = page.getViewport({scale: 3.0});
              
              // Create a canvas to render the PDF page
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              
              // Render the PDF page to the canvas with high quality
              await page.render({
                canvasContext: context,
                viewport: viewport,
                intent: 'print' // Use 'print' for higher quality
              }).promise;
              
              // Convert canvas to image URL with high quality
              const imageUrl = canvas.toDataURL('image/png', 1.0);
              
              // Add page to the array
              pages.push({
                id: generateId(),
                pageNumber: i,
                imageUrl: imageUrl,
                selected: false,
                rotation: 0,
                originalPageIndex: i - 1, // Store the original page index (0-based)
                width: viewport.width,
                height: viewport.height
              });
            }
            
            // Create the PDF object with actual thumbnails and original bytes
            newPdf = {
              id: generateId(),
              name: fileName,
              pages: pages,
              originalPdfBytes: originalPdfBytes.length > 0 ? originalPdfBytes : null, // Only store if not empty
              base64PdfData: base64PdfData // Store base64 version for export
            };
          } catch (error) {
            console.error('Error processing PDF:', error);
            // Fallback to sample PDF if processing fails
            showToast('Error processing PDF, using placeholder instead', 'error');
            newPdf = createSamplePdf(fileName, Math.floor(Math.random() * 5) + 2);
          }
        } else if (fileType.includes('image')) {
          // Handle image file (convert to single-page PDF)
          try {
            // Read the image file as an ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            
            // Create a blob URL for the image
            const blob = new Blob([arrayBuffer], { type: fileType });
            const imageUrl = URL.createObjectURL(blob);
            
            // Load the image to get dimensions
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = imageUrl;
            });
            
            // Create a PDF from the image with high quality
            const pdfDoc = await PDFDocument.create();
            
            // Convert image to PDF with maximum quality
            let embeddedImage;
            if (fileType.includes('png')) {
              embeddedImage = await pdfDoc.embedPng(new Uint8Array(arrayBuffer));
            } else if (fileType.includes('jpg') || fileType.includes('jpeg')) {
              embeddedImage = await pdfDoc.embedJpg(new Uint8Array(arrayBuffer));
            } else {
              throw new Error('Unsupported image format');
            }
            
            // Add a page with the image at full quality
            const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
            page.drawImage(embeddedImage, {
              x: 0,
              y: 0,
              width: embeddedImage.width,
              height: embeddedImage.height,
            });
            
            // Save the PDF bytes with high quality settings
            const pdfBytes = await pdfDoc.save({
              useObjectStreams: false,
              addDefaultPage: false,
              preservePDFForm: true,
              updateMetadata: false
            });
            
            // Convert to base64 for maximum quality preservation
            const base64PdfData = arrayBufferToBase64(pdfBytes);
            
            // Create a single-page PDF from the image
            newPdf = {
              id: generateId(),
              name: fileName,
              pages: [{
                id: generateId(),
                pageNumber: 1,
                imageUrl: imageUrl,
                selected: false,
                rotation: 0,
                width: img.width,
                height: img.height
              }],
              originalPdfBytes: pdfBytes, // Store the generated PDF bytes
              base64PdfData: base64PdfData // Store base64 version for export
            };
            
            console.log(`Successfully created PDF from image: ${fileName}`);
          } catch (imageError) {
            console.error('Error processing image:', imageError);
            showToast(`Failed to process image ${fileName}`, 'error');
            
            // Create a basic entry without PDF bytes
            const imageUrl = URL.createObjectURL(file);
            newPdf = {
              id: generateId(),
              name: fileName,
              pages: [{
                id: generateId(),
                pageNumber: 1,
                imageUrl: imageUrl,
                selected: false,
                rotation: 0
              }],
              originalPdfBytes: null
            };
          }
        }
        
        if (newPdf) {
          appState.pdfs.push(newPdf);
        }
      } catch (error) {
        console.error(`Error processing file ${fileName}:`, error);
        showToast(`Failed to process ${fileName}`, 'error');
      }
    }
    
    // Update UI
    renderPdfs();
    updateButtonStates();
    showToast(`Successfully added ${files.length} file(s)`, 'success');
  });
  
  // Trigger file selection dialog
  fileInput.click();
}

        
        // Drag and Drop Handlers
        let draggedPageId = null;
        let draggedDocId = null;
        
        function handleDragStart(event, pageId, docId) {
          draggedPageId = pageId;
          draggedDocId = docId;
          event.dataTransfer.setData('text/plain', pageId);
          event.target.classList.add('opacity-50');
        }
        
        function handleDragOver(event, targetIndex) {
          event.preventDefault();
          
          // Find the closest .pdf-page-wrapper element
          const closestPageWrapper = event.target.closest('.pdf-page-wrapper');
          if (closestPageWrapper) {
            // Add a visual indicator for drop target
            document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
            
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator bg-blue-500 h-1 w-8 absolute left-1/2 transform -translate-x-1/2 rounded';
            
            // Calculate if we should insert before or after
            const rect = closestPageWrapper.getBoundingClientRect();
            const isBeforeMiddle = event.clientX < rect.left + rect.width / 2;
            
            if (isBeforeMiddle) {
              indicator.style.top = `${rect.top - 2}px`;
            } else {
              indicator.style.top = `${rect.bottom + 2}px`;
            }
            
            document.body.appendChild(indicator);
          }
        }
        
        function handleDragLeave(event) {
          // Remove drop indicators when leaving a drop target
          document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        }
        
        function handleDrop(event, targetDocId, targetIndex) {
          event.preventDefault();
          
          // Remove any drop indicators
          document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
          
          if (!draggedPageId || !draggedDocId) return;
          
          // Calculate the exact drop position relative to the target
          const closestPageWrapper = event.target.closest('.pdf-page-wrapper');
          if (closestPageWrapper) {
            const rect = closestPageWrapper.getBoundingClientRect();
            const isBeforeMiddle = event.clientX < rect.left + rect.width / 2;
            
            // Adjust the target index based on drop position
            if (!isBeforeMiddle) {
              targetIndex += 1;
            }
          }
          
          // Perform the reorder operation
          handleReorderPage(draggedDocId, draggedPageId, targetDocId, targetIndex);
          
          // Reset drag state
          draggedPageId = null;
          draggedDocId = null;
        }
        
        function handleDragEnd(event) {
          // Remove opacity from the dragged element
          event.target.classList.remove('opacity-50');
          
          // Remove any drop indicators
          document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        }
        
        // Rendering Functions
        function renderPdfs() {
          pdfWorkspace.innerHTML = '';
          
          if (appState.pdfs.length === 0) {
            pdfWorkspace.innerHTML = `
              <div class="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-md p-8">
                <h2 class="text-2xl font-bold text-gray-700 mb-4">No PDFs Available</h2>
                <p class="text-gray-600 mb-6">Upload a PDF to get started with your workflow</p>
                <button id="empty-upload-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md flex items-center">
                  <i class="fas fa-cloud-upload-alt mr-2"></i>
                  Upload PDF
                </button>
              </div>
            `;
            
            document.getElementById('empty-upload-btn').addEventListener('click', handleUpload);
            return;
          }
          
          appState.pdfs.forEach((pdf, pdfIndex) => {
            const pdfElement = document.createElement('div');
            pdfElement.className = 'mb-6 pdf-container';
            
            const allPagesSelected = pdf.pages.length > 0 && pdf.pages.every(page => page.selected);
            const somePageSelected = pdf.pages.some(page => page.selected);
            
            pdfElement.innerHTML = `
              <div class="flex items-center justify-between mb-2 bg-blue-50 p-2 rounded-md">
                <div class="flex items-center gap-2">
                  <div class="drag-handle">
                    <i class="fas fa-grip-vertical text-gray-500"></i>
                  </div>
                  
                  <div class="flex items-center bg-blue-600 text-white px-3 py-1 rounded-md">
                    <span class="font-bold">${pdfIndex + 1}</span>
                  </div>
                  
                  <div class="flex flex-col">
                    <h3 class="font-semibold text-gray-800">${pdf.name}</h3>
                    <span class="text-sm text-gray-500">${pdf.pages.length} pages</span>
                  </div>
                </div>
                
                <div class="flex gap-2">

                  <button
                    class="delete-selected-btn border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1 rounded-md text-sm flex items-center gap-1 ${somePageSelected ? '' : 'hidden'}"
                    data-doc-id="${pdf.id}">
                    <i class="fas fa-trash-alt text-xs"></i>
                    Delete Selected
                  </button>

                  <button
                    class="select-all-btn border ${somePageSelected ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-600'} hover:bg-gray-50 px-3 py-1 rounded-md text-sm flex items-center gap-1"
                    data-doc-id="${pdf.id}"
                  >
                    <i class="fas fa-check-square text-xs"></i>
                    ${allPagesSelected ? 'Deselect All' : 'Select All'}
                  </button>

                  
                  <button
                    class="delete-pdf-btn border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1 rounded-md text-sm flex items-center gap-1"
                    data-doc-id="${pdf.id}"
                  >
                    <i class="fas fa-trash text-xs"></i>
                    Delete PDF
                  </button>
                  
                  <button
                    class="toggle-expand-btn border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1 rounded-md text-sm"
                  >
                    Collapse
                  </button>
                </div>
              </div>
              
              <div class="pdf-pages mt-2">
                <div class="flex flex-wrap items-start" data-doc-id="${pdf.id}">
                  <!-- Pages will be rendered here -->
                </div>
              </div>
            `;
            
            const pagesContainer = pdfElement.querySelector('.flex-wrap');
            
            // Render pages
            pdf.pages.forEach((page, pageIndex) => {
              const pageElement = document.createElement('div');
              pageElement.className = 'pdf-page-wrapper relative m-1';
              pageElement.draggable = true;
              
              pageElement.dataset.pageId = page.id;
              pageElement.dataset.docId = pdf.id;
              pageElement.dataset.pageIndex = pageIndex;
              
// In the renderPdfs function where the page controls are defined
pageElement.innerHTML = `
  <div class="${'pdf-page-thumbnail w-24 h-32 cursor-pointer transition-all duration-300' + (page.selected ? ' selected' : '')}">
    <div 
      class="w-full h-full flex items-center justify-center overflow-hidden bg-white"
      style="transform: rotate(${page.rotation}deg); transition: transform 0.3s ease"
    >
      <img 
        src="${page.imageUrl}" 
        alt="Page ${page.pageNumber}" 
        class="max-w-full max-h-full object-contain"
      />
    </div>
  </div>
  
  ${page.selected ? `
    <div class="absolute -top-2 -right-2 z-10">
      <span class="w-5 h-5 flex items-center justify-center rounded-full bg-blue-600 text-white">
        <i class="fas fa-check text-xs"></i>
      </span>
    </div>
  ` : ''}
  
  <div class="pdf-page-controls rounded-b-md">
    <button
      class="text-white hover:text-yellow-400 p-1 rotate-ccw-btn"
      title="Rotate counter-clockwise"
      data-page-id="${page.id}"
      data-doc-id="${pdf.id}"
    >
      <i class="fas fa-undo-alt text-xs"></i>
    </button>
    <button
      class="text-white hover:text-yellow-400 p-1 rotate-cw-btn"
      title="Rotate clockwise"
      data-page-id="${page.id}"
      data-doc-id="${pdf.id}"
    >
      <i class="fas fa-redo-alt text-xs"></i>
    </button>
    <button
      class="text-white hover:text-blue-400 p-1 duplicate-page-btn"
      title="Duplicate page"
      data-page-id="${page.id}"
      data-doc-id="${pdf.id}"
    >
      <i class="fas fa-copy text-xs"></i>
    </button>
    <button
      class="text-white hover:text-blue-400 p-1 preview-page-btn"
      title="Preview page"
      data-page-id="${page.id}"
      data-doc-id="${pdf.id}"
    >
      <i class="fas fa-eye text-xs"></i>
    </button>
    <button
      class="text-white hover:text-red-400 p-1 delete-page-btn hidden"
      title="Delete page"
      data-page-id="${page.id}"
      data-doc-id="${pdf.id}"
    >
      <i class="fas fa-trash text-xs"></i>
    </button>
  </div>
  
  <div class="text-center text-xs mt-1 text-gray-600">
    Page ${page.pageNumber}
  </div>
`;
              
              // Handle page click for selection
              pageElement.querySelector('.pdf-page-thumbnail').addEventListener('click', function(e) {
                handlePageClick(page.id, pdf.id);
              });
              
              // Handle rotate counter-clockwise
              pageElement.querySelector('.rotate-ccw-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                handleRotatePage(page.id, pdf.id, false);
              });
              
              // Handle rotate clockwise
              pageElement.querySelector('.rotate-cw-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                handleRotatePage(page.id, pdf.id, true);
              });

              pageElement.querySelector('.duplicate-page-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                handleDuplicatePage(page.id, pdf.id);
              });

              // Add this after the other event listeners in the renderPdfs function
              pageElement.querySelector('.preview-page-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                handlePreviewPage(page.id, pdf.id);
              });
              
              // Handle delete page
              pageElement.querySelector('.delete-page-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                handleDeletePage(page.id, pdf.id);
              });
              
              // Drag and drop handlers
              pageElement.addEventListener('dragstart', function(e) {
                handleDragStart(e, page.id, pdf.id);
              });
              
              pageElement.addEventListener('dragover', function(e) {
                handleDragOver(e, pageIndex);
              });
              
              pageElement.addEventListener('dragleave', handleDragLeave);
              
              pageElement.addEventListener('drop', function(e) {
                handleDrop(e, pdf.id, pageIndex);
              });
              
              pageElement.addEventListener('dragend', handleDragEnd);
              
              pagesContainer.appendChild(pageElement);
            });
            
            pdfWorkspace.appendChild(pdfElement);
          });
          
          // Add event listeners for PDF-level actions
          document.querySelectorAll('.select-all-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              handleSelectAll(this.dataset.docId);
            });
          });
          
          document.querySelectorAll('.delete-pdf-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              handleDeletePdf(this.dataset.docId);
            });
          });

          document.querySelectorAll('.delete-selected-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              handleDeleteSelectedPages(this.dataset.docId);
            });
          });
          
          document.querySelectorAll('.toggle-expand-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              const pagesContainer = this.closest('.pdf-container').querySelector('.pdf-pages');
              const isCollapsed = pagesContainer.classList.contains('hidden');
              
              if (isCollapsed) {
                pagesContainer.classList.remove('hidden');
                this.textContent = 'Collapse';
              } else {
                pagesContainer.classList.add('hidden');
                this.textContent = 'Expand';
              }
            });
          });
        }

      // Update the handlePreviewPage function to fix resizing issues
      function handlePreviewPage(pageId, documentId) {
        const pdf = appState.pdfs.find(p => p.id === documentId);
        if (!pdf) {
          showToast('PDF not found', 'error');
          return;
        }
        
        const page = pdf.pages.find(p => p.id === pageId);
        if (!page) {
          showToast('Page not found', 'error');
          return;
        }
        
        // Check if preview panel already exists, if not create it
        let previewPanel = document.getElementById('page-preview-panel');
        const workspaceContainer = document.querySelector('.pdf-workspace-container');
        
        // Function to set up resize functionality
        const setupResizeHandlers = () => {
          const resizeHandle = document.getElementById('preview-resize-handle');
          if (!resizeHandle) return;
          
          let isResizing = false;
          let initialX;
          let initialWidth;
          
          const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            const windowWidth = window.innerWidth;
            const deltaX = e.clientX - initialX;
            // Calculate new width based on mouse position
            // We're resizing from the left edge, so we need to subtract deltaX from initialWidth
            const newWidth = Math.max(20, Math.min(80, (initialWidth - deltaX) * 100 / windowWidth));
            
            previewPanel.style.width = `${newWidth}%`;
            
            if (workspaceContainer) {
              workspaceContainer.style.width = `${100 - newWidth}%`;
            }
          };
          
          const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Remove overlay
            const overlay = document.getElementById('resize-overlay');
            if (overlay) overlay.remove();
          };
          
          resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isResizing = true;
            initialX = e.clientX;
            initialWidth = parseInt(getComputedStyle(previewPanel).width, 10);
            
            // Add overlay to prevent iframe interactions during resize
            const overlay = document.createElement('div');
            overlay.id = 'resize-overlay';
            overlay.className = 'fixed inset-0 z-50';
            overlay.style.cursor = 'ew-resize';
            document.body.appendChild(overlay);
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          });
        };
        
        if (!previewPanel) {
          // Create the preview panel
          previewPanel = document.createElement('div');
          previewPanel.id = 'page-preview-panel';
          previewPanel.className = 'fixed top-0 right-0 h-full bg-gray-900 bg-opacity-95 shadow-xl z-40';
          previewPanel.style.width = '40%';
          
          // Add the panel to the document
          document.body.appendChild(previewPanel);
          
          // Adjust the workspace container width to match
          if (workspaceContainer) {
            workspaceContainer.style.width = '60%';
            workspaceContainer.style.transition = 'width 0.3s ease';
          }
        }
        
// Update the preview panel HTML to include a resize icon
previewPanel.innerHTML = `
  <div id="preview-resize-handle" class="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-blue-500 z-50 flex items-center">
    <div class="resize-icon text-blue-500 opacity-80 hover:opacity-100 ml-[-8px] bg-gray-800 p-1 rounded-sm shadow-md">
      <i class="fas fa-arrows-alt-h"></i>
    </div>
  </div>
  <div class="flex flex-col h-full">
    <div class="flex justify-between items-center p-4 border-b border-gray-700">
      <h3 class="text-lg font-medium text-white">
        ${pdf.name} - Page ${page.pageNumber}
      </h3>
      <button id="close-preview-panel" class="text-gray-400 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
    
    <div class="flex-1 overflow-auto flex items-center justify-center p-4">
      <div class="preview-image-container" style="transform: rotate(${page.rotation}deg); transition: transform 0.3s ease">
        <img 
          src="${page.imageUrl}" 
          alt="Page ${page.pageNumber}" 
          class="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
    
    <div class="p-4 border-t border-gray-700 flex justify-between">
      <div class="flex space-x-2">
        <button id="preview-rotate-ccw" class="bg-gray-800 text-white hover:bg-gray-700 px-3 py-1 rounded-md">
          <i class="fas fa-undo-alt mr-1"></i> Rotate Left
        </button>
        <button id="preview-rotate-cw" class="bg-gray-800 text-white hover:bg-gray-700 px-3 py-1 rounded-md">
          <i class="fas fa-redo-alt mr-1"></i> Rotate Right
        </button>
      </div>
      <button id="preview-close" class="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1 rounded-md">
        Close
      </button>
    </div>
  </div>
`;
        
        // Function to handle closing the preview
        const closePreview = () => {
          previewPanel.remove();
          // Reset the workspace container width to 100%
          if (workspaceContainer) {
            workspaceContainer.style.width = '100%';
          }
          document.removeEventListener('keydown', handleEscKey);
        };
        
        // Add event listeners
        document.getElementById('close-preview-panel').addEventListener('click', closePreview);
        document.getElementById('preview-close').addEventListener('click', closePreview);
        
        // Add rotation functionality in the preview
        let currentRotation = page.rotation || 0;
        const previewImage = previewPanel.querySelector('.preview-image-container');
        
        document.getElementById('preview-rotate-ccw').addEventListener('click', () => {
          currentRotation = (currentRotation - 90) % 360;
          if (currentRotation < 0) currentRotation += 360;
          previewImage.style.transform = `rotate(${currentRotation}deg)`;
          
          // Update the actual page rotation
          page.rotation = currentRotation;
          renderPdfs();
        });
        
        document.getElementById('preview-rotate-cw').addEventListener('click', () => {
          currentRotation = (currentRotation + 90) % 360;
          previewImage.style.transform = `rotate(${currentRotation}deg)`;
          
          // Update the actual page rotation
          page.rotation = currentRotation;
          renderPdfs();
        });
        
        // Close on escape key
        const handleEscKey = (e) => {
          if (e.key === 'Escape') {
            closePreview();
          }
        };
        
        document.addEventListener('keydown', handleEscKey);
        
        // Set up resize handlers after updating content
        setupResizeHandlers();
      }

        // Add this function to handle page duplication
        function handleDuplicatePage(pageId, documentId) {
          // Save state before making changes
          saveState();
          
          const pdf = appState.pdfs.find(p => p.id === documentId);
          if (!pdf) {
            showToast('PDF not found', 'error');
            return;
          }
          
          const pageIndex = pdf.pages.findIndex(p => p.id === pageId);
          if (pageIndex === -1) {
            showToast('Page not found', 'error');
            return;
          }
          
          // Create a deep copy of the page to preserve all properties
          const pageCopy = JSON.parse(JSON.stringify(pdf.pages[pageIndex]));
          
          // Create a new page with a new ID but same content
          const newPage = {
            ...pageCopy,
            id: generateId(),
            selected: false,
            // Keep the same rotation, imageUrl, and other properties
          };
          
          // Insert the duplicated page right after the original
          pdf.pages.splice(pageIndex + 1, 0, newPage);
          
          // Update page numbers for all pages in the PDF
          pdf.pages.forEach((page, idx) => {
            page.pageNumber = idx + 1;
          });
          
          // Update UI
          renderPdfs();
          updateButtonStates();
          showToast('Page duplicated successfully', 'success');
        }
        
        // History Management Functions
        function saveState() {
          // Create a deep copy of the current state
          const currentState = {
            pdfs: JSON.parse(JSON.stringify(appState.pdfs)),
            selectedPages: Array.from(appState.selectedPages)
          };
          
          // Add current state to history
          appState.history.past.push(currentState);
          
          // Clear future states when a new action is performed
          appState.history.future = [];
          
          // Update undo/redo buttons
          updateUndoRedoButtons();
        }

        async function isPdfValid(pdfBytes) {
          if (!pdfBytes || pdfBytes.length < 5) {
            return false;
          }
          
          try {
            // Try to load the PDF with simplified validation options
            await PDFDocument.load(pdfBytes, {
              ignoreEncryption: true,
              updateMetadata: false
              // Removed the problematic ParseSpeeds.Slow option
            });
            return true;
          } catch (error) {
            console.error('PDF validation error:', error);
            return false;
          }
        }

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}


// Add this function to the WorkflowTool object or where appropriate in your workflow.js file
async function exportPdfWithQuality(pdfData, fileName) {
  try {
      console.log('Exporting PDF with preserved quality');
      
      // Ensure we have binary data in the correct format
      let pdfBuffer;
      
      if (pdfData instanceof Uint8Array) {
          pdfBuffer = pdfData;
      } else if (Buffer.isBuffer(pdfData)) {
          pdfBuffer = pdfData;
      } else if (Array.isArray(pdfData)) {
          pdfBuffer = new Uint8Array(pdfData);
      } else if (typeof pdfData === 'string') {
          // Handle base64 string
          pdfBuffer = Buffer.from(pdfData, 'base64');
      } else if (pdfData instanceof ArrayBuffer) {
          pdfBuffer = new Uint8Array(pdfData);
      } else if (pdfData.buffer && pdfData.buffer instanceof ArrayBuffer) {
          // Handle TypedArray with buffer property
          pdfBuffer = new Uint8Array(pdfData.buffer);
      } else {
          // If we have a PDFDocument object, serialize it
          try {
              pdfBuffer = await pdfData.save();
          } catch (error) {
              console.error('Error serializing PDF document:', error);
              throw new Error('Unable to process PDF data: ' + error.message);
          }
      }
      
      console.log(`PDF buffer size for export: ${pdfBuffer.byteLength} bytes`);
      
      // Use the IPC to send to main process for saving
      return new Promise((resolve, reject) => {
          ipcRenderer.once('export-pdf-result', (event, result) => {
              if (result.success) {
                  console.log('PDF exported successfully:', result.filePath);
                  console.log('File size:', result.fileSize, 'bytes');
                  resolve(result);
              } else {
                  console.error('Error exporting PDF:', result.error);
                  reject(new Error(result.error));
              }
          });
          
          // Send the buffer directly without any processing
          ipcRenderer.send('export-pdf', {
              buffer: pdfBuffer,
              fileName: fileName || 'exported-document.pdf',
              preserveQuality: true // Flag to indicate we want to preserve quality
          });
      });
  } catch (error) {
      console.error('Error in exportPdfWithQuality:', error);
      throw error;
  }
}

// Replace your existing export function with this one or add it to your workflow
// For example, if you have a function like:
// async function exportPdf() { ... }
// Replace it with this implementation or call this function from there


function hasBeenModified(pdf) {
  // If originalPageCount is not set, initialize it
  if (pdf.originalPageCount === undefined && pdf.originalPdfBytes) {
    pdf.originalPageCount = pdf.pages.length;
  }
  
  // Check if pages have been reordered, rotated, or deleted
  if (pdf.originalPageCount && pdf.pages.length !== pdf.originalPageCount) {
    console.log(`PDF modified: page count changed from ${pdf.originalPageCount} to ${pdf.pages.length}`);
    return true;
  }
  
  // Check if any page has rotation or is not in original order
  for (let i = 0; i < pdf.pages.length; i++) {
    const page = pdf.pages[i];
    if (page.rotation) {
      console.log(`PDF modified: page ${i+1} has rotation ${page.rotation}`);
      return true;
    }
    if (page.originalPageIndex !== undefined && page.originalPageIndex !== i) {
      console.log(`PDF modified: page order changed, page at position ${i+1} was originally at ${page.originalPageIndex+1}`);
      return true;
    }
  }
  
  console.log('PDF not modified: using original bytes');
  return false;
}
        
        function undo() {
          if (appState.history.past.length === 0) return;
          
          // Get the current state to move to future
          const currentState = {
            pdfs: JSON.parse(JSON.stringify(appState.pdfs)),
            selectedPages: Array.from(appState.selectedPages)
          };
          
          // Move current state to future
          appState.history.future.unshift(currentState);
          
          // Get previous state
          const previousState = appState.history.past.pop();
          
          // Apply previous state
          appState.pdfs = previousState.pdfs;
          appState.selectedPages = new Set(previousState.selectedPages);
          
          // Update UI
          renderPdfs();
          updateButtonStates();
          updateUndoRedoButtons();
        }
        
        function redo() {
          if (appState.history.future.length === 0) return;
          
          // Get the current state to move to past
          const currentState = {
            pdfs: JSON.parse(JSON.stringify(appState.pdfs)),
            selectedPages: Array.from(appState.selectedPages)
          };
          
          // Move current state to past
          appState.history.past.push(currentState);
          
          // Get next state
          const nextState = appState.history.future.shift();
          
          // Apply next state
          appState.pdfs = nextState.pdfs;
          appState.selectedPages = new Set(nextState.selectedPages);
          
          // Update UI
          renderPdfs();
          updateButtonStates();
          updateUndoRedoButtons();
        }
        
        function updateUndoRedoButtons() {
          undoBtn.disabled = appState.history.past.length === 0;
          redoBtn.disabled = appState.history.future.length === 0;
        }

        // Add this function to handle deleting a single page
        function handleDeletePage(pageId, documentId) {
          // Save state before making changes
          saveState();
          
          // Find the PDF
          const pdf = appState.pdfs.find(p => p.id === documentId);
          if (!pdf) return;
          
          // Find the page index
          const pageIndex = pdf.pages.findIndex(page => page.id === pageId);
          if (pageIndex === -1) return;
          
          // Remove the page from selected pages if it was selected
          appState.selectedPages.delete(pageId);
          
          // Remove the page from the PDF
          pdf.pages.splice(pageIndex, 1);
          
          // If PDF is now empty, remove it
          if (pdf.pages.length === 0) {
            const pdfIndex = appState.pdfs.findIndex(p => p.id === documentId);
            appState.pdfs.splice(pdfIndex, 1);
          } else {
            // Update page numbers
            pdf.pages.forEach((page, idx) => {
              page.pageNumber = idx + 1;
            });
          }
          
          // Update UI
          renderPdfs();
          updateButtonStates();
          showToast('Page deleted', 'success');
        }
        
        // Modify existing functions to save state before changes
        
        function handlePageClick(pageId, documentId) {
          saveState();
          
          const pdf = appState.pdfs.find(p => p.id === documentId);
          if (!pdf) return;
          
          const page = pdf.pages.find(p => p.id === pageId);
          if (!page) return;
          
          page.selected = !page.selected;
          
          if (page.selected) {
            appState.selectedPages.add(pageId);
          } else {
            appState.selectedPages.delete(pageId);
          }
          
          renderPdfs();
          updateButtonStates();
        }
        
        function handleSelectAll(documentId) {
          saveState();
          
          const pdf = appState.pdfs.find(p => p.id === documentId);
          if (!pdf) return;
          
          const allSelected = pdf.pages.every(page => page.selected);
          
          pdf.pages.forEach(page => {
            page.selected = !allSelected;
            
            if (page.selected) {
              appState.selectedPages.add(page.id);
            } else {
              appState.selectedPages.delete(page.id);
            }
          });
          
          renderPdfs();
          updateButtonStates();
        }
        
                

        function handleDeleteSelectedPages(docId) {
          // Save state before making changes
          saveState();
          
          // Find the PDF by ID
          const pdfIndex = appState.pdfs.findIndex(pdf => pdf.id === docId);
          if (pdfIndex === -1) return;
          
          const pdf = appState.pdfs[pdfIndex];
          
          // Get the IDs of selected pages
          const selectedPageIds = pdf.pages
            .filter(page => page.selected)
            .map(page => page.id);
          
          if (selectedPageIds.length === 0) {
            showToast('No pages selected to delete', 'warning');
            return;
          }
          
          // Remove selected pages
          pdf.pages = pdf.pages.filter(page => !page.selected);
          
          // Clear selected pages from the global selection set
          selectedPageIds.forEach(pageId => {
            appState.selectedPages.delete(pageId);
          });
          
          // If all pages were deleted, remove the PDF
          if (pdf.pages.length === 0) {
            appState.pdfs.splice(pdfIndex, 1);
            showToast('PDF deleted (all pages were selected)', 'success');
          } else {
            // Update page numbers
            pdf.pages.forEach((page, idx) => {
              page.pageNumber = idx + 1;
            });
            
            showToast(`Deleted ${selectedPageIds.length} selected page(s)`, 'success');
          }
          
          // Update UI
          renderPdfs();
          updateButtonStates();
        }

        
        // This should be placed before the event listener setup section where you have:
        // Setup Event Listeners
        uploadPdfBtn.addEventListener('click', handleUpload);
        rotateClockwiseBtn.addEventListener('click', () => handleRotateSelectedPages(true));
        rotateCounterclockwiseBtn.addEventListener('click', () => handleRotateSelectedPages(false));
        deletePagesBtn.addEventListener('click', handleDeleteSelectedPages);
        
        newPdfBtn.addEventListener('click', function() {
          // If pages are selected, create a new PDF from those pages
          // Otherwise, create an empty PDF
          if (appState.selectedPages.size > 0) {
            handleGroupSelectedPages();
          } else {
            // createEmptyPdf();
          }
        });

        combinePdfsBtn.addEventListener('click', openCombineModal);
        cancelBtn.addEventListener('click', handleCancelSelection);
        // previewBtn.addEventListener('click', handlePreview);
        closeCombineModal.addEventListener('click', () => combineModal.classList.add('hidden'));
        cancelCombine.addEventListener('click', () => combineModal.classList.add('hidden'));
        confirmCombine.addEventListener('click', handleCombinePdfs);
        
        // Add event listeners for undo/redo buttons
        if (undoBtn) undoBtn.addEventListener('click', undo);
        if (redoBtn) redoBtn.addEventListener('click', redo);

        // if (previewBtn) {
        //   previewBtn.textContent = 'Export PDF';
        //   previewBtn.innerHTML = 'Export PDF <i class="fas fa-file-export text-sm"></i>';
        //   previewBtn.id = 'export-pdf-btn';
        //   previewBtn.addEventListener('click', handleExportPdfs);
        // }
        
        // Initialize the application
        function init() {
          // Add sample PDFs for demo
          addSamplePdfs();
          
          // Update button states
          updateButtonStates();
          updateUndoRedoButtons();

          const exportPdfBtn = document.getElementById('export-pdf-btn');
          if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', handleExportPdfs);
          }
          
          // Add CSS for selected pages and toast
          const style = document.createElement('style');
          style.textContent = `
            .pdf-page-thumbnail {
              border: 2px solid transparent;
              border-radius: 4px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              position: relative;
            }
            
            .pdf-page-thumbnail.selected {
              border-color: #3b82f6;
              box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
            }
            
            .pdf-page-controls {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              background: rgba(0, 0, 0, 0.6);
              display: flex;
              justify-content: space-around;
              opacity: 0;
              transition: opacity 0.2s;
            }
            
            .pdf-page-wrapper:hover .pdf-page-controls {
              opacity: 1;
            }
            
            #toast-container {
              position: fixed;
              bottom: 20px;
              right: 20px;
              z-index: 9999;
            }
            
            .toast {
              padding: 12px 20px;
              margin-bottom: 10px;
              border-radius: 4px;
              color: white;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              display: flex;
              align-items: center;
              transition: opacity 0.3s;
            }
            
            .toast.info {
              background-color: #3b82f6;
            }
            
            .toast.success {
              background-color: #10b981;
            }
            
            .toast.error {
              background-color: #ef4444;
            }
            
            .drop-indicator {
              position: absolute;
              z-index: 100;
            }
          `;
          
          document.head.appendChild(style);



          // Add this to the beginning of your script or in the initialization section
          function addPreviewStyles() {
            const styleElement = document.createElement('style');
            styleElement.textContent = `
              #page-preview-panel {
                box-shadow: -5px 0 15px rgba(0, 0, 0, 0.3);
                transform: translateX(0);
              }
              
              #page-preview-panel.hidden {
                transform: translateX(100%);
              }
              
              .preview-image-container {
                max-height: calc(100vh - 150px);
                display: flex;
                align-items: center;
                justify-content: center;
              }
              
              .preview-image-container img {
                max-width: 85%;
                object-fit: contain;
              }
            `;
            document.head.appendChild(styleElement);
          }

          // Call this function during initialization
          addPreviewStyles();

        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    
}

// At the end of your file, replace the export statement with:
// Export the workflow tool and the PDF workflow initialization function
window.WorkflowTool = WorkflowTool;
window.initPdfWorkflow = initPdfWorkflow;
  