// PDF Viewer and Manager
// Handles PDF loading, rendering, and UI interactions

// Global variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.0;
let rotation = 0;
let canvas = document.getElementById('pdf-viewer');
let ctx = canvas.getContext('2d');
let currentPdfUrl = null;
let uploadedPdfs = [];

// Initialize the PDF viewer
function initPdfViewer() {
    // Set up PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('PDF Viewer initialized');
}

// Set up event listeners for UI controls
function setupEventListeners() {
    // Upload button
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('file-input');
    
    if (uploadButton && fileInput) {
        uploadButton.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', handleFileUpload);
    }
    
    // Navigation buttons
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            if (pageNum <= 1) return;
            pageNum--;
            queueRenderPage(pageNum);
        });
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            if (pageNum >= pdfDoc.numPages) return;
            pageNum++;
            queueRenderPage(pageNum);
        });
    }
    
    // Zoom controls
    const zoomInButton = document.getElementById('zoom-in');
    const zoomOutButton = document.getElementById('zoom-out');
    const zoomResetButton = document.getElementById('zoom-reset');
    const zoomLevel = document.getElementById('zoom-level');
    
    if (zoomInButton) {
        zoomInButton.addEventListener('click', () => {
            scale = Math.min(scale * 1.25, 3.0);
            zoomLevel.textContent = `${Math.round(scale * 100)}%`;
            queueRenderPage(pageNum);
        });
    }
    
    if (zoomOutButton) {
        zoomOutButton.addEventListener('click', () => {
            scale = Math.max(scale * 0.8, 0.5);
            zoomLevel.textContent = `${Math.round(scale * 100)}%`;
            queueRenderPage(pageNum);
        });
    }
    
    if (zoomResetButton) {
        zoomResetButton.addEventListener('click', () => {
            scale = 1.0;
            zoomLevel.textContent = '100%';
            queueRenderPage(pageNum);
        });
    }
    
    // Rotation controls
    const rotateCwButton = document.getElementById('rotate-cw');
    const rotateCcwButton = document.getElementById('rotate-ccw');
    
    if (rotateCwButton) {
        rotateCwButton.addEventListener('click', () => {
            rotation = (rotation + 90) % 360;
            queueRenderPage(pageNum);
        });
    }
    
    if (rotateCcwButton) {
        rotateCcwButton.addEventListener('click', () => {
            rotation = (rotation - 90 + 360) % 360;
            queueRenderPage(pageNum);
        });
    }
}

// Handle file upload
function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Clear the empty thumbnails message if it exists
    const emptyThumbnails = document.querySelector('.empty-thumbnails');
    if (emptyThumbnails) {
        emptyThumbnails.style.display = 'none';
    }
    
    // Clear previous PDFs
    uploadedPdfs = [];
    
    // Clear previous thumbnails
    const thumbnailContainer = document.getElementById('thumbnails-container');
    if (thumbnailContainer) {
        thumbnailContainer.innerHTML = '';
    }
    
    // Process each uploaded file (but we'll only keep the last one)
    Array.from(files).forEach(file => {
        const fileReader = new FileReader();
        
        fileReader.onload = function() {
            const pdfData = new Uint8Array(this.result);
            const pdfUrl = URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }));
            
            // Add to uploaded PDFs array (replacing any previous)
            const pdfInfo = {
                name: file.name,
                url: pdfUrl,
                size: file.size,
                data: pdfData
            };
            
            // Clear previous PDF URLs to avoid memory leaks
            if (uploadedPdfs.length > 0) {
                uploadedPdfs.forEach(pdf => {
                    if (pdf.url) {
                        URL.revokeObjectURL(pdf.url);
                    }
                });
                uploadedPdfs = [];
            }
            
            uploadedPdfs.push(pdfInfo);
            
            // Create thumbnail
            createPdfThumbnail(pdfInfo);
            
            // Load the PDF
            loadPdf(pdfUrl);
        };
        
        fileReader.readAsArrayBuffer(file);
    });
    
    // Reset the file input to allow uploading the same file again
    event.target.value = '';
}

// Create a thumbnail for a PDF with all pages
async function createPdfThumbnail(pdfInfo) {
    try {
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(pdfInfo.url);
        const pdf = await loadingTask.promise;
        
        // Create the thumbnail container
        const thumbnailContainer = document.getElementById('thumbnails-container');
        
        // Create PDF file container
        const pdfFileContainer = document.createElement('div');
        pdfFileContainer.className = 'pdf-file-container';
        
        // Create filename container with rename icon
        const fileNameContainer = document.createElement('div');
        fileNameContainer.className = 'pdf-file-header';
        
        const fileName = document.createElement('div');
        fileName.className = 'pdf-file-name';
        fileName.title = pdfInfo.name;
        fileName.textContent = pdfInfo.name;
        
        const actionIcons = document.createElement('div');
        actionIcons.className = 'pdf-file-actions';
        actionIcons.innerHTML = `
            <button class="action-button rename-button" title="Rename PDF">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
            </button>
        `;
        
        fileNameContainer.appendChild(fileName);
        fileNameContainer.appendChild(actionIcons);
        pdfFileContainer.appendChild(fileNameContainer);
        
        // Create a container for all page thumbnails
        const pagesThumbnailsContainer = document.createElement('div');
        pagesThumbnailsContainer.className = 'pdf-pages-thumbnails';
        
        // For large PDFs, we'll use lazy loading
        const totalPages = pdf.numPages;
        const isLargePDF = totalPages > 20; // Consider PDFs with more than 20 pages as "large"
        
        // Add page count info
        const pageCountInfo = document.createElement('div');
        pageCountInfo.className = 'pdf-page-count';
        pageCountInfo.textContent = `${totalPages} pages`;
        pagesThumbnailsContainer.appendChild(pageCountInfo);
        
        // Initial batch size - render fewer thumbnails for large PDFs
        const initialBatchSize = isLargePDF ? 5 : 20;
        
        // Function to render a single thumbnail
        const renderThumbnail = async (pageNum) => {
            try {
                const page = await pdf.getPage(pageNum);
                const thumbnailCanvas = document.createElement('canvas');
                const thumbnailCtx = thumbnailCanvas.getContext('2d');
                const viewport = page.getViewport({ scale: 0.18 });
                thumbnailCanvas.width = viewport.width;
                thumbnailCanvas.height = viewport.height;
            
                await page.render({
                    canvasContext: thumbnailCtx,
                    viewport: viewport
                }).promise;
            
                // Wrap canvas in a clickable div for styling and interaction
                const thumbDiv = document.createElement('div');
                thumbDiv.className = 'pdf-page-thumbnail';
                thumbDiv.dataset.pdfUrl = pdfInfo.url;
                thumbDiv.dataset.pageNum = pageNum;
                thumbDiv.appendChild(thumbnailCanvas);
            
                // Add page number label
                const pageNumLabel = document.createElement('div');
                pageNumLabel.className = 'page-number-label';
                pageNumLabel.textContent = `Page ${pageNum}`;
                thumbDiv.appendChild(pageNumLabel);
            
                // Click to load this page
                thumbDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.pdf-page-thumbnail').forEach(t => t.classList.remove('active'));
                    thumbDiv.classList.add('active');
                    loadPdf(pdfInfo.url, pageNum);
                });
            
                // Mark first page as active if this is the first PDF
                if (pageNum === 1 && uploadedPdfs.length === 1) {
                    thumbDiv.classList.add('active');
                }
            
                return thumbDiv;
            } catch (error) {
                console.error(`Error rendering thumbnail for page ${pageNum}:`, error);
                // Return a placeholder for failed thumbnails
                const errorThumb = document.createElement('div');
                errorThumb.className = 'pdf-page-thumbnail error';
                errorThumb.dataset.pdfUrl = pdfInfo.url;
                errorThumb.dataset.pageNum = pageNum;
                errorThumb.textContent = `Page ${pageNum} (Error)`;
                return errorThumb;
            }
        };
        
        // Create placeholder thumbnails for all pages
        for (let i = 1; i <= totalPages; i++) {
            const placeholderThumb = document.createElement('div');
            placeholderThumb.className = 'pdf-page-thumbnail placeholder';
            placeholderThumb.dataset.pdfUrl = pdfInfo.url;
            placeholderThumb.dataset.pageNum = i;
            placeholderThumb.innerHTML = `
                <div class="thumbnail-placeholder">
                    <div class="placeholder-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="12" cy="12" r="2"></circle>
                        </svg>
                    </div>
                    <div class="page-number-label">Page ${i}</div>
                </div>
            `;
            
            // Add click handler to load the page and render its thumbnail
            placeholderThumb.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // Only proceed if this is still a placeholder
                if (!placeholderThumb.classList.contains('placeholder')) return;
                
                // Show loading state
                placeholderThumb.classList.add('loading');
                
                // Render the actual thumbnail
                const realThumb = await renderThumbnail(i);
                
                // Replace placeholder with real thumbnail
                placeholderThumb.parentNode.replaceChild(realThumb, placeholderThumb);
                
                // Activate the thumbnail and load the page
                document.querySelectorAll('.pdf-page-thumbnail').forEach(t => t.classList.remove('active'));
                realThumb.classList.add('active');
                loadPdf(pdfInfo.url, i);
            });
            
            pagesThumbnailsContainer.appendChild(placeholderThumb);
        }
        
        // Render initial batch of thumbnails
        (async () => {
            for (let i = 1; i <= Math.min(initialBatchSize, totalPages); i++) {
                const placeholder = pagesThumbnailsContainer.querySelector(`.pdf-page-thumbnail[data-page-num="${i}"]`);
                if (placeholder && placeholder.classList.contains('placeholder')) {
                    const realThumb = await renderThumbnail(i);
                    placeholder.parentNode.replaceChild(realThumb, placeholder);
                }
            }
            
            // Set up intersection observer for lazy loading remaining thumbnails
            if (isLargePDF) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(async (entry) => {
                        if (entry.isIntersecting && entry.target.classList.contains('placeholder')) {
                            const pageNum = parseInt(entry.target.dataset.pageNum);
                            entry.target.classList.add('loading');
                            const realThumb = await renderThumbnail(pageNum);
                            if (entry.target.parentNode) { // Check if still in DOM
                                entry.target.parentNode.replaceChild(realThumb, entry.target);
                            }
                            observer.unobserve(entry.target);
                        }
                    });
                }, { rootMargin: '100px' });
                
                // Observe all remaining placeholders
                pagesThumbnailsContainer.querySelectorAll('.pdf-page-thumbnail.placeholder').forEach(placeholder => {
                    if (parseInt(placeholder.dataset.pageNum) > initialBatchSize) {
                        observer.observe(placeholder);
                    }
                });
            }
        })();
        
        pdfFileContainer.appendChild(pagesThumbnailsContainer);
        
        // Add click event to load PDF
        pdfFileContainer.addEventListener('click', (e) => {
            // Don't trigger if clicking the rename button or a thumbnail
            if (!e.target.closest('.action-button') && !e.target.closest('.pdf-page-thumbnail')) {
                document.querySelectorAll('.pdf-file-container').forEach(container => {
                    container.classList.remove('active');
                });
                pdfFileContainer.classList.add('active');
                loadPdf(pdfInfo.url);
            }
        });
        
        // Add rename functionality
        const renameButton = pdfFileContainer.querySelector('.rename-button');
        renameButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileNameElement = pdfFileContainer.querySelector('.pdf-file-name');
            const currentName = fileNameElement.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'rename-input';
            
            fileNameElement.textContent = '';
            fileNameElement.appendChild(input);
            input.focus();
            
            const handleRename = () => {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    fileNameElement.textContent = newName;
                    fileNameElement.title = newName;
                    pdfInfo.name = newName;
                } else {
                    fileNameElement.textContent = currentName;
                }
            };
            
            input.addEventListener('blur', handleRename);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleRename();
                    input.blur();
                }
            });
        });
        
        thumbnailContainer.appendChild(pdfFileContainer);
        
        if (uploadedPdfs.length === 1) {
            pdfFileContainer.classList.add('active');
        }
    } catch (error) {
        console.error('Error creating thumbnail:', error);
    }
}

// Load a PDF document
function loadPdf(url, pageNumber = 1) {
    // Show loading indicator
    const pdfContainer = document.getElementById('pdf-container');
    if (pdfContainer) {
        pdfContainer.classList.add('loading');
    }
    
    // Hide the "no PDF" message
    const noPdfMessage = document.getElementById('no-pdf-message');
    if (noPdfMessage) {
        noPdfMessage.style.display = 'none';
    }
    
    // Set the page number
    pageNum = pageNumber;
    
    // Store the current PDF URL
    currentPdfUrl = url;
    window.currentPdfUrl = url; // <-- Fix: Make it globally accessible
    
    // Load the PDF document
    pdfjsLib.getDocument(url).promise.then(function(pdf) {
        pdfDoc = pdf;
        
        // Update page count
        const pageCount = document.getElementById('page-count');
        if (pageCount) {
            pageCount.textContent = pdf.numPages;
        }
        
        // Enable navigation buttons
        const prevButton = document.getElementById('prev-page');
        const nextButton = document.getElementById('next-page');
        
        if (prevButton) {
            prevButton.disabled = pageNum <= 1;
        }
        
        if (nextButton) {
            nextButton.disabled = pageNum >= pdf.numPages;
        }
        
        // Render the specified page
        renderPage(pageNum);
        
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
    });
}

// Render a specific page of the PDF
function renderPage(num) {
    pageRendering = true;
    
    // Update page number display
    const pageNumDisplay = document.getElementById('page-num');
    if (pageNumDisplay) {
        pageNumDisplay.textContent = num;
    }
    
    // Update navigation buttons
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    
    if (prevButton) {
        prevButton.disabled = num <= 1;
    }
    
    if (nextButton && pdfDoc) {
        nextButton.disabled = num >= pdfDoc.numPages;
    }
    
    // Get the page
    pdfDoc.getPage(num).then(function(page) {
        // Calculate the viewport based on scale and rotation
        const viewport = page.getViewport({ scale: scale, rotation: rotation });
        
        // Set canvas dimensions to match the viewport
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render the page
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        
        // Wait for rendering to finish
        renderTask.promise.then(function() {
            pageRendering = false;
            
            // Remove loading indicator
            const pdfContainer = document.getElementById('pdf-container');
            if (pdfContainer) {
                pdfContainer.classList.remove('loading');
            }
            
            // If another page rendering is pending, render that page
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
            
            // Update active thumbnail
            updateActiveThumbnail(num);
        });
        
    }).catch(function(error) {
        console.error('Error rendering page:', error);
        pageRendering = false;
    });
}

// Update the active thumbnail based on the current page
function updateActiveThumbnail(pageNum) {
    // Remove active class from all thumbnails
    document.querySelectorAll('.pdf-page-thumbnail').forEach(thumb => {
        thumb.classList.remove('active');
    });
    
    // Find the thumbnail for the current PDF and page
    const activeThumbnail = document.querySelector(`.pdf-page-thumbnail[data-pdf-url="${currentPdfUrl}"][data-page-num="${pageNum}"]`);
    if (activeThumbnail) {
        activeThumbnail.classList.add('active');
        
        // Scroll the thumbnail into view if needed
        activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Queue a page for rendering
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// Initialize the PDF viewer when the document is loaded
document.addEventListener('DOMContentLoaded', initPdfViewer);

// Make functions available globally
window.PdfViewer = {
    loadPdf,
    renderPage,
    queueRenderPage
};