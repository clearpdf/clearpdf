// Multiple File Upload and Compression Queue

class MultiUploadTool {
    constructor() {
        this.init();
        this.compressionQueue = [];
        this.isProcessing = false;
    }

    init() {
        // Create UI elements for multiple file upload
        this.createMultiUploadUI();
        this.setupEventListeners();
        
        // Make the tool available globally
        window.MultiUploadTool = this;
        console.log('Multiple File Upload Tool initialized');
    }

    createMultiUploadUI() {
        // Create container for multi-upload UI
        const container = document.createElement('div');
        container.id = 'multi-upload-container';
        container.className = 'tool-container';
        
        // Create UI elements
        container.innerHTML = `
            <div class="tool-header">
                <h3>Batch Compression</h3>
                <button id="close-multi-upload" class="tool-close-btn">×</button>
            </div>
            <div id="multi-upload-content" class="tool-content">
                <div class="upload-area" id="multi-upload-area">
                    <input type="file" id="multi-file-input" multiple accept=".pdf" style="display: none;">
                    <div class="upload-prompt">
                        <i class="fas fa-file-upload"></i>
                        <p>Drop multiple PDF files here or click to select</p>
                    </div>
                </div>
                <div id="upload-queue-container">
                    <h4>Files to compress</h4>
                    <div id="upload-queue-list"></div>
                </div>
                <div class="compression-options-multi">
                    <p>Select compression level for all files:</p>
                    <div class="option-buttons">
                        <button class="option-button-multi" data-size="1">Small (1MB)</button>
                        <button class="option-button-multi" data-size="5">Medium (5MB)</button>
                        <button class="option-button-multi" data-size="10">Large (10MB)</button>
                    </div>
                    <div class="custom-size-container">
                        <input type="number" id="custom-size-multi" placeholder="Custom size (MB)">
                        <button id="custom-size-btn-multi">Apply</button>
                    </div>
                </div>
                <button id="process-queue-btn" class="primary-button">Compress All Files</button>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(container);
        
        // Initially hide the container
        container.style.display = 'none';
    }

    setupEventListeners() {
        // Connect batch compress button to show the multi-upload UI
        const batchCompressBtn = document.getElementById('batch-compress-tool');
        if (batchCompressBtn) {
            batchCompressBtn.addEventListener('click', () => {
                this.showMultiUploadUI();
            });
        }
        
        // Close button for multi-upload UI
        const closeBtn = document.getElementById('close-multi-upload');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideMultiUploadUI();
            });
        }
        
        // Setup drag and drop for multi-upload area
        const uploadArea = document.getElementById('multi-upload-area');
        const fileInput = document.getElementById('multi-file-input');
        
        if (uploadArea && fileInput) {
            // Click to select files
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            // Handle file selection
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
            
            // Drag and drop events
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileSelection(e.dataTransfer.files);
                }
            });
        }
        
        // Setup compression option buttons
        const optionButtons = document.querySelectorAll('.option-button-multi');
        if (optionButtons) {
            optionButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    this.selectedCompressionSize = parseFloat(e.target.dataset.size);
                    this.highlightSelectedOption(e.target);
                });
            });
        }
        
        // Setup custom size button
        const customSizeBtn = document.getElementById('custom-size-btn-multi');
        const customSizeInput = document.getElementById('custom-size-multi');
        
        if (customSizeBtn && customSizeInput) {
            customSizeBtn.addEventListener('click', () => {
                const customSize = parseFloat(customSizeInput.value);
                if (!isNaN(customSize) && customSize > 0) {
                    this.selectedCompressionSize = customSize;
                    this.highlightSelectedOption(null);
                } else {
                    alert('Please enter a valid size in MB');
                }
            });
        }
        
        // Setup process queue button
        const processQueueBtn = document.getElementById('process-queue-btn');
        if (processQueueBtn) {
            processQueueBtn.addEventListener('click', () => {
                this.processCompressionQueue();
            });
        }
    }
    
    showMultiUploadUI() {
        const container = document.getElementById('multi-upload-container');
        if (container) {
            container.style.display = 'block';
        }
    }
    
    hideMultiUploadUI() {
        const container = document.getElementById('multi-upload-container');
        if (container) {
            container.style.display = 'none';
        }
    }
    
    highlightSelectedOption(selectedButton) {
        // Remove highlight from all buttons
        const buttons = document.querySelectorAll('.option-button-multi');
        buttons.forEach(btn => btn.classList.remove('selected'));
        
        // Add highlight to selected button
        if (selectedButton) {
            selectedButton.classList.add('selected');
        }
    }

    handleFileSelection(files) {
        if (!files || files.length === 0) return;
        
        // Filter for PDF files only
        const pdfFiles = Array.from(files).filter(file => 
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );
        
        if (pdfFiles.length === 0) {
            alert('Please select PDF files only.');
            return;
        }
        
        // Add files to queue
        this.addFilesToQueue(pdfFiles);
    }
    
    addFilesToQueue(files) {
        const queueList = document.getElementById('upload-queue-list');
        
        files.forEach(file => {
            // Create a unique ID for this file
            const fileId = 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            
            // Create file entry in queue
            const fileEntry = document.createElement('div');
            fileEntry.className = 'queue-file-entry';
            fileEntry.dataset.fileId = fileId;
            
            fileEntry.innerHTML = `
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${this.formatFileSize(file.size)}</span>
                </div>
                <div class="file-actions">
                    <button class="remove-file-btn" title="Remove from queue">×</button>
                </div>
                <div class="file-status">Queued</div>
            `;
            
            // Add to queue list
            queueList.appendChild(fileEntry);
            
            // Add remove button functionality
            const removeBtn = fileEntry.querySelector('.remove-file-btn');
            removeBtn.addEventListener('click', () => {
                // Remove from UI
                fileEntry.remove();
                
                // Remove from queue
                this.compressionQueue = this.compressionQueue.filter(item => item.id !== fileId);
            });
            
            // Add to compression queue
            this.compressionQueue.push({
                id: fileId,
                file: file,
                status: 'queued'
            });
        });
    }
    
    async processCompressionQueue() {
        if (this.isProcessing) {
            alert('Already processing files. Please wait.');
            return;
        }
        
        if (this.compressionQueue.length === 0) {
            alert('Please add files to the queue first.');
            return;
        }
        
        if (!this.selectedCompressionSize) {
            alert('Please select a compression level first.');
            return;
        }
        
        this.isProcessing = true;
        
        // Process each file in the queue
        for (let i = 0; i < this.compressionQueue.length; i++) {
            const queueItem = this.compressionQueue[i];
            
            if (queueItem.status === 'completed' || queueItem.status === 'processing') {
                continue;
            }
            
            // Update status in UI
            this.updateFileStatus(queueItem.id, 'processing');
            
            try {
                // Load the file
                await this.loadFileForCompression(queueItem.file);
                
                // Compress the file using the CompressTool
                if (window.CompressTool) {
                    await window.CompressTool.compressPDF(this.selectedCompressionSize);
                    
                    // Update status
                    this.updateFileStatus(queueItem.id, 'completed');
                    queueItem.status = 'completed';
                } else {
                    throw new Error('Compression Tool not available');
                }
            } catch (error) {
                console.error('Error processing file:', error);
                this.updateFileStatus(queueItem.id, 'error: ' + error.message);
                queueItem.status = 'error';
            }
        }
        
        this.isProcessing = false;
        alert('All files have been processed!');
    }
    
    updateFileStatus(fileId, status) {
        const fileEntry = document.querySelector(`.queue-file-entry[data-file-id="${fileId}"]`);
        if (fileEntry) {
            const statusElement = fileEntry.querySelector('.file-status');
            if (statusElement) {
                statusElement.textContent = status;
                
                // Add appropriate class for styling
                statusElement.className = 'file-status';
                statusElement.classList.add('status-' + status.split(':')[0]);
            }
        }
    }
    
    async loadFileForCompression(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const arrayBuffer = e.target.result;
                const blob = new Blob([arrayBuffer], {type: 'application/pdf'});
                const url = URL.createObjectURL(blob);
                
                // Set as current PDF
                window.currentPdfUrl = url;
                
                // Add to uploaded PDFs array if it exists
                if (!window.uploadedPdfs) {
                    window.uploadedPdfs = [];
                }
                
                window.uploadedPdfs.push({
                    name: file.name,
                    url: url,
                    size: file.size
                });
                
                resolve();
            };
            
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the multi-upload tool when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MultiUploadTool();
});
