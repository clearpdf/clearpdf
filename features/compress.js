// Compression Tool for PDF files

class CompressTool {
    constructor() {
        this.init();
    }

    init() {
        // Initialize the compression tool
        this.compressButton = document.getElementById('compress-tool');
        this.compressionOptions = document.getElementById('compression-options');
        this.optionButtons = document.querySelectorAll('.option-button');
        this.customSizeInput = document.getElementById('custom-size');
        this.customSizeBtn = document.getElementById('custom-size-btn');
        
        // Load the worker-init.js script
        this.loadWorkerScript();
        
        this.setupEventListeners();
        
        // Make the tool available globally
        window.CompressTool = this;
        console.log('Compression Tool initialized');
    }

    loadWorkerScript() {
        // Create a bridge script to load the ES module and expose it globally
        const bridgeScript = document.createElement('script');
        bridgeScript.textContent = `
            // Create a dynamic import for the ES module
            import('./compress-lib/worker-init.js')
                .then(module => {
                    // Expose the _GSPS2PDF function globally
                    window._GSPS2PDF = module._GSPS2PDF;
                    console.log('Compression worker loaded successfully');
                })
                .catch(error => {
                    console.error('Error loading compression worker:', error);
                });
        `;
        bridgeScript.type = 'module';
        document.head.appendChild(bridgeScript);
    }

    setupEventListeners() {
        // Toggle compression options when compress button is clicked
        if (this.compressButton) {
            this.compressButton.addEventListener('click', () => {
                this.toggleCompressionOptions();
            });
        }

        // Add event listeners to compression option buttons
        if (this.optionButtons) {
            this.optionButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const targetSize = parseFloat(e.target.dataset.size);
                    this.compressPDF(targetSize);
                });
            });
        }

        // Add event listener to custom size button
        if (this.customSizeBtn) {
            this.customSizeBtn.addEventListener('click', () => {
                const customSize = parseFloat(this.customSizeInput.value);
                if (!isNaN(customSize) && customSize > 0) {
                    this.compressPDF(customSize);
                } else {
                    alert('Please enter a valid size in MB');
                }
            });
        }
    }

    toggleCompressionOptions() {
        if (this.compressionOptions) {
            this.compressionOptions.classList.toggle('active');
        }
    }

    async loadPDFData(response, filename) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", response);
            xhr.responseType = "arraybuffer";
            xhr.onload = function () {
                window.URL.revokeObjectURL(response);
                const blob = new Blob([xhr.response], {type: "application/pdf"});
                const pdfURL = window.URL.createObjectURL(blob);
                const size = xhr.response.byteLength;
                resolve({pdfURL, size});
            };
            xhr.onerror = reject;
            xhr.send();
        });
    }

    async compressPDF(targetSizeMB) {
        // Check if a PDF is currently loaded
        if (!window.currentPdfUrl) {
            alert('Please load a PDF first');
            return;
        }

        try {
            // Show loading indicator first
            this.showLoadingIndicator();
            
            // Check if _GSPS2PDF is available, with retry logic
            if (typeof window._GSPS2PDF !== 'function') {
                console.log('Waiting for compression library to load...');
                
                // Wait for up to 5 seconds for the library to load
                let attempts = 0;
                while (typeof window._GSPS2PDF !== 'function' && attempts < 10) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }
                
                if (typeof window._GSPS2PDF !== 'function') {
                    throw new Error('Compression library not loaded. Please refresh the page and try again.');
                }
            }
            
            // Get the current PDF data
            const dataObject = { 
                psDataURL: window.currentPdfUrl,
                targetSizeMB: targetSizeMB // Pass the target size to the worker
            };
            
            // Compress the PDF using the GhostScript worker
            const response = await window._GSPS2PDF(dataObject);
            
            // Extract the PDF URL and compression stats
            const { pdfDataURL, originalSize, newSize, compressionRatio, shouldClearPreview } = response;
            
            // Load the compressed PDF data
            const { pdfURL, size } = await this.loadPDFData(pdfDataURL, 'compressed.pdf');
            
            // Check if compression actually reduced the size
            if (compressionRatio <= 0) {
                // If compression didn't help, use the original
                alert(`Compression did not reduce file size. The PDF may already be optimized.\nOriginal size: ${this.formatFileSize(originalSize)}`);
                URL.revokeObjectURL(pdfURL);
                this.hideLoadingIndicator();
                this.toggleCompressionOptions();
                return;
            }
            
            // Create a download link for the compressed PDF
            this.downloadCompressedPDF(pdfURL);
            
            // Clear the PDF preview if requested
            if (shouldClearPreview) {
                this.clearPdfPreview();
            }
            
            // Hide loading indicator
            this.hideLoadingIndicator();
            
            // Hide compression options
            this.toggleCompressionOptions();
            
            // Show compression results with the accurate stats from the worker
            alert(`Compression complete!\nOriginal size: ${this.formatFileSize(originalSize)}\nNew size: ${this.formatFileSize(newSize)}\nReduced by: ${compressionRatio}%`);
            
        } catch (error) {
            console.error('Error compressing PDF:', error);
            alert('Error compressing PDF: ' + error.message);
            this.hideLoadingIndicator();
        }
    }
    
    clearPdfPreview() {
        // Clear the PDF canvas
        const pdfCanvas = document.getElementById('pdf-viewer');
        if (pdfCanvas) {
            const ctx = pdfCanvas.getContext('2d');
            ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
            
            // Add a loading class to the container
            const pdfContainer = document.getElementById('pdf-container');
            if (pdfContainer) {
                pdfContainer.classList.add('loading');
            }
        }
        
        // Clear thumbnails - both in the thumbnails container and the pdf-pages-thumbnails
        const thumbnailsContainer = document.getElementById('pdf-thumbnails');
        if (thumbnailsContainer) {
            thumbnailsContainer.innerHTML = '';
        }
        
        // Clear the pdf-pages-thumbnails container
        const pagesThumbnails = document.querySelector('.pdf-pages-thumbnails');
        if (pagesThumbnails) {
            pagesThumbnails.innerHTML = '';
        }
        
        // Also clear any thumbnail canvases that might be elsewhere in the DOM
        const thumbnailCanvases = document.querySelectorAll('.pdf-page-thumbnail canvas');
        thumbnailCanvases.forEach(canvas => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
        
        // Reset any global PDF state
        window.currentPdfUrl = null;
        window.currentPage = 1;
        
        // Clean up any blob URLs that might be in use
        if (window.uploadedPdfs && window.uploadedPdfs.length > 0) {
            window.uploadedPdfs.forEach(pdf => {
                if (pdf.url && pdf.url.startsWith('blob:')) {
                    URL.revokeObjectURL(pdf.url);
                }
            });
            window.uploadedPdfs = [];
        }
        
        console.log('PDF preview and thumbnails cleared');
    }

    getOriginalPdfSize() {
        // Try to get the size of the current PDF
        if (window.uploadedPdfs && window.uploadedPdfs.length > 0) {
            const currentPdf = window.uploadedPdfs.find(pdf => pdf.url === window.currentPdfUrl);
            if (currentPdf && currentPdf.size) {
                return currentPdf.size;
            }
        }
        return 0;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    downloadCompressedPDF(pdfURL) {
        // Get the original filename
        let filename = 'compressed_document.pdf';
        if (window.uploadedPdfs && window.uploadedPdfs.length > 0) {
            const currentPdf = window.uploadedPdfs.find(pdf => pdf.url === window.currentPdfUrl);
            if (currentPdf && currentPdf.name) {
                const baseName = currentPdf.name.replace(/\.pdf$/i, '');
                filename = `${baseName}-compressed.pdf`;
            }
        }
        
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfURL;
        downloadLink.download = filename;
        downloadLink.click();
        
        // Clean up
        setTimeout(() => window.URL.revokeObjectURL(pdfURL), 100);
    }

    showLoadingIndicator() {
        // Create and show a loading indicator with dynamic messages
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'compression-loading';
        
        // Array of loading messages with emojis - shown in logical progression
        const loadingMessages = [
            '📊 Analyzing PDF structure...',
            '🔄 Optimizing file size...',
            '📝 Compressing content...',
            '⚡ Almost there...',
            '✨ Adding final touches...',
            '🔍 Scanning document layers...',
            '📦 Packaging elements efficiently...',
            '🎯 Targeting optimal compression...',
            '🔧 Fine-tuning parameters...',
            '📈 Calculating compression ratios...',
            '🎨 Preserving image quality...',
            '📄 Processing page elements...',
            '💫 Applying smart compression...',
            '🔐 Maintaining document integrity...',
            '⚙️ Adjusting compression settings...',
            '🌟 Enhancing performance...',
            '📱 Optimizing for mobile viewing...',
            '🚀 Boosting processing speed...',
            '🎭 Balancing size and quality...',
            '🔮 Predicting final size...',
            '⚖️ Harmonizing components...',
            '🎪 Organizing content structure...',
            '🎯 Precision optimization in progress...',
            '🎨 Refining visual elements...',
            '📐 Calculating dimensions...',
            '🧩 Assembling optimized components...',
            '🎬 Preparing final render...',
            '🔄 Synchronizing changes...',
            '📡 Processing data streams...',
            '🎵 Harmonizing file structure...',
            '🎪 Orchestrating compression sequence...',
            '🌈 Finalizing color optimization...',
            '🎯 Targeting compression goals...',
            '🔮 Analyzing compression potential...',
            '⭐ Polishing final output...'
        ];

        loadingDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <p id="compression-status">🚀 Starting compression...</p>
        `;
        document.body.appendChild(loadingDiv);

        // Cycle through messages to show progress
        let messageIndex = 0;
        this.loadingInterval = setInterval(() => {
            const statusElement = document.getElementById('compression-status');
            if (statusElement) {
                statusElement.textContent = loadingMessages[messageIndex];
                messageIndex = (messageIndex + 1) % loadingMessages.length;
            }
        }, 2500); // Show each message for 2.5 seconds
    }

    hideLoadingIndicator() {
        // Remove the loading indicator and clear the interval
        const loadingDiv = document.getElementById('compression-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
        
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }
}

// Initialize the compression tool when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CompressTool();
});