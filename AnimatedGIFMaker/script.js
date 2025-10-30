class AnimatedGIFMaker {
    constructor() {
        this.images = [];
        this.maxImages = 10;
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.targetWidth = 500;
        this.gif = null;
        this.isCreating = false;
        this.animationTimeout = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.updateUI();
        this.animationTimeout = null;
    }

    initializeElements() {
        // Input elements
        this.imageInput = document.getElementById('imageInput');
        this.durationSlider = document.getElementById('frameDuration');
        this.durationValue = document.getElementById('durationValue');
        this.qualitySelect = document.getElementById('gifQuality');
        
        // Display elements
        this.thumbnailsGrid = document.getElementById('thumbnailsGrid');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewPlaceholder = document.getElementById('previewPlaceholder');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.errorMessage = document.getElementById('errorMessage');
        
        // Buttons
        this.previewBtn = document.getElementById('previewBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Modal
        this.successModal = document.getElementById('successModal');
        this.closeModalBtn = document.getElementById('closeModal');
    }

    attachEventListeners() {
        // File input
        this.imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Duration slider
        this.durationSlider.addEventListener('input', (e) => {
            this.durationValue.textContent = `${e.target.value}s`;
        });
        
        // Buttons
        this.previewBtn.addEventListener('click', () => {
            console.log('Preview button clicked');
            this.createPreview();
        });
        this.downloadBtn.addEventListener('click', () => this.downloadGIF());
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        
        // Drag and drop
        const uploadArea = document.querySelector('.upload-area');
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Modal close on background click
        this.successModal.addEventListener('click', (e) => {
            if (e.target === this.successModal) {
                this.closeModal();
            }
        });
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }

    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const files = Array.from(event.dataTransfer.files);
        this.processFiles(files);
    }

    async processFiles(files) {
        console.log('Processing files:', files.length);
        this.hideError();
        
        // Filter valid image files
        const validFiles = files.filter(file => {
            if (!file.type.startsWith('image/')) {
                this.showError(`"${file.name}" is not a valid image file.`);
                return false;
            }
            if (file.size > this.maxFileSize) {
                this.showError(`"${file.name}" is too large. Maximum size is 5MB.`);
                return false;
            }
            return true;
        });
        
        console.log('Valid files:', validFiles.length);

        // Check total image limit
        if (this.images.length + validFiles.length > this.maxImages) {
            this.showError(`Maximum ${this.maxImages} images allowed. You can add ${this.maxImages - this.images.length} more.`);
            return;
        }

        // Process each file
        for (const file of validFiles) {
            try {
                const processedImage = await this.processImage(file);
                this.images.push(processedImage);
            } catch (error) {
                this.showError(`Error processing "${file.name}": ${error.message}`);
            }
        }

        this.updateUI();
        this.imageInput.value = ''; // Reset input
    }

    async processImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                try {
                    // Calculate dimensions maintaining aspect ratio
                    const aspectRatio = img.width / img.height;
                    let newWidth = this.targetWidth;
                    let newHeight = this.targetWidth / aspectRatio;
                    
                    if (newHeight > this.targetWidth) {
                        newHeight = this.targetWidth;
                        newWidth = this.targetWidth * aspectRatio;
                    }
                    
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    
                    // Draw and resize image
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    
                    // Create thumbnail
                    const thumbnailCanvas = document.createElement('canvas');
                    const thumbnailCtx = thumbnailCanvas.getContext('2d');
                    thumbnailCanvas.width = 80;
                    thumbnailCanvas.height = 80;
                    
                    // Draw thumbnail (center crop)
                    const scale = Math.max(80 / newWidth, 80 / newHeight);
                    const scaledWidth = newWidth * scale;
                    const scaledHeight = newHeight * scale;
                    const offsetX = (80 - scaledWidth) / 2;
                    const offsetY = (80 - scaledHeight) / 2;
                    
                    thumbnailCtx.drawImage(canvas, offsetX, offsetY, scaledWidth, scaledHeight);
                    
                    resolve({
                        id: Date.now() + Math.random(),
                        name: file.name,
                        canvas: canvas,
                        thumbnail: thumbnailCanvas.toDataURL(),
                        width: newWidth,
                        height: newHeight
                    });
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    updateUI() {
        this.updateThumbnails();
        this.updateButtons();
    }

    updateThumbnails() {
        if (this.images.length === 0) {
            this.thumbnailsGrid.innerHTML = `
                <div class="no-images-placeholder">
                    <div class="placeholder-icon">🖼️</div>
                    <div class="placeholder-text">No images uploaded yet</div>
                </div>
            `;
        } else {
            this.thumbnailsGrid.innerHTML = this.images.map((image, index) => `
                <div class="thumbnail-item" data-id="${image.id}">
                    <img src="${image.thumbnail}" alt="${image.name}" class="thumbnail-image">
                    <button class="thumbnail-remove" onclick="gifMaker.removeImage('${image.id}')" aria-label="Remove ${image.name}">
                        ×
                    </button>
                </div>
            `).join('');
        }
    }

    updateButtons() {
        const hasImages = this.images.length > 0;
        const hasPreview = !!this.currentGifDataUrl;
        console.log('Updating buttons - hasImages:', hasImages, 'isCreating:', this.isCreating, 'hasPreview:', hasPreview);
        this.previewBtn.disabled = !hasImages || this.isCreating;
        this.downloadBtn.disabled = !hasPreview || this.isCreating;
        this.clearBtn.disabled = !hasImages && !hasPreview;
        console.log('Preview button disabled:', this.previewBtn.disabled, 'Download button disabled:', this.downloadBtn.disabled);
    }

    removeImage(imageId) {
        this.images = this.images.filter(img => img.id !== imageId);
        this.updateUI();
        this.hideError();
    }

    async createPreview() {
        console.log('createPreview called, images count:', this.images.length);
        
        if (this.images.length === 0) {
            this.showError('Please upload at least one image.');
            return;
        }

        console.log('Starting animation preview...');
        this.isCreating = true;
        this.updateButtons();
        this.showLoading('Creating preview...');

        try {
            // Determine canvas size (use the largest dimensions)
            const maxWidth = Math.max(...this.images.map(img => img.width));
            const maxHeight = Math.max(...this.images.map(img => img.height));
            
            this.previewCanvas.width = maxWidth;
            this.previewCanvas.height = maxHeight;
            
            const duration = parseFloat(this.durationSlider.value) * 1000; // Convert to milliseconds
            
            // Start canvas animation
            this.startCanvasAnimation(duration);
            
            // Create an animated GIF blob for download
            const blob = await this.createAnimatedGifBlob(maxWidth, maxHeight, duration);
            console.log('Received blob from createAnimatedGifBlob:', blob, 'Type:', typeof blob, 'Is Blob:', blob instanceof Blob);
            
            // Ensure we have a valid blob
            if (!blob || !(blob instanceof Blob)) {
                throw new Error('Invalid blob returned from GIF creation');
            }
            
            this.currentGifDataUrl = URL.createObjectURL(blob);
            
            this.hideLoading();
            this.previewPlaceholder.classList.add('hidden');
            this.previewCanvas.classList.remove('hidden');
            this.isCreating = false;
            this.updateButtons();

        } catch (error) {
            this.hideLoading();
            this.showError(`Error creating preview: ${error.message}`);
            this.isCreating = false;
            this.updateButtons();
        }
    }

    startCanvasAnimation(duration) {
        let currentFrame = 0;
        const ctx = this.previewCanvas.getContext('2d');
        const maxWidth = this.previewCanvas.width;
        const maxHeight = this.previewCanvas.height;
        
        const animate = () => {
            if (currentFrame >= this.images.length) {
                currentFrame = 0;
            }
            
            const image = this.images[currentFrame];
            
            // Clear canvas
            ctx.clearRect(0, 0, maxWidth, maxHeight);
            
            // Fill background with white
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, maxWidth, maxHeight);
            
            // Center the image on the canvas
            const offsetX = (maxWidth - image.width) / 2;
            const offsetY = (maxHeight - image.height) / 2;
            
            ctx.drawImage(image.canvas, offsetX, offsetY);
            
            currentFrame++;
            
            // Continue animation
            this.animationTimeout = setTimeout(animate, duration);
        };
        
        // Stop any existing animation
        if (this.animationTimeout) {
            clearTimeout(this.animationTimeout);
        }
        
        animate();
    }

    async createAnimatedGifBlob(width, height, duration) {
        if (this.images.length === 0) return null;
        
        console.log(`Creating animated GIF: ${width}x${height}, ${this.images.length} frames, ${duration}ms delay`);
        
        try {
            // Check if GIF constructor is available
            if (typeof GIF === 'undefined') {
                console.error('GIF constructor not available, falling back to static image');
                return this.createStaticImageBlob(width, height);
            }

            // First, we need to fetch the worker script from CDN
            console.log('Fetching GIF worker script from CDN...');
            const workerResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
            if (!workerResponse.ok) {
                throw new Error('Failed to fetch worker script');
            }
            const workerBlob = await workerResponse.blob();
            const workerUrl = URL.createObjectURL(workerBlob);

            // Create GIF with proper configuration
            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: width,
                height: height,
                workerScript: workerUrl,
                repeat: 0, // 0 = loop forever
                debug: false
            });

            console.log('GIF instance created successfully');

            // Add frames to the GIF
            for (let i = 0; i < this.images.length; i++) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = width;
                canvas.height = height;
                
                const image = this.images[i];
                console.log(`Adding frame ${i + 1}/${this.images.length} to GIF`);
                
                // Fill background with white
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                
                // Center the image
                const offsetX = (width - image.width) / 2;
                const offsetY = (height - image.height) / 2;
                
                ctx.drawImage(image.canvas, offsetX, offsetY);
                
                // Add frame to GIF with specified delay
                gif.addFrame(canvas, { delay: duration });
            }

            console.log('All frames added to GIF, starting render...');

            // Create a promise to handle the GIF rendering
            return new Promise((resolve, reject) => {
                // Set up timeout to prevent hanging
                const timeout = setTimeout(() => {
                    console.error('GIF creation timed out after 30 seconds');
                    URL.revokeObjectURL(workerUrl); // Clean up
                    resolve(this.createStaticImageBlob(width, height));
                }, 30000);

                // Handle GIF completion
                gif.on('finished', function(blob) {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(workerUrl); // Clean up worker URL
                    console.log('GIF creation completed!');
                    console.log('Blob size:', blob.size, 'bytes');
                    console.log('Blob type:', blob.type);
                    
                    // Validate the blob
                    if (blob && blob.size > 0 && blob instanceof Blob && blob.type === 'image/gif') {
                        console.log('Valid GIF blob received from gif.js');
                        resolve(blob);
                    } else {
                        console.error('Invalid blob received from gif.js, falling back to static image');
                        resolve(this.createStaticImageBlob(width, height));
                    }
                }.bind(this));

                // Handle GIF creation progress
                gif.on('progress', function(p) {
                    console.log('GIF creation progress:', Math.round(p * 100) + '%');
                });

                // Handle errors
                gif.on('error', function(error) {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(workerUrl); // Clean up
                    console.error('Error during GIF creation:', error);
                    resolve(this.createStaticImageBlob(width, height));
                }.bind(this));

                // Start rendering
                gif.render();
            });

        } catch (error) {
            console.error('Error in createAnimatedGifBlob:', error);
            return this.createStaticImageBlob(width, height);
        }
    }
    
    createStaticImageBlob(width, height) {
        console.log('Creating static image blob as fallback');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        // Draw first image as static preview
        if (this.images.length > 0) {
            const firstImage = this.images[0];
            
            // Fill background with white
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            
            // Center the image
            const offsetX = (width - firstImage.width) / 2;
            const offsetY = (height - firstImage.height) / 2;
            
            ctx.drawImage(firstImage.canvas, offsetX, offsetY);
        }
        
        // Convert to blob
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                console.log('Created static image blob:', blob);
                resolve(blob);
            }, 'image/png');
        });
    }
    


    displayPreview(dataUrl) {
        // This method is now simplified since we handle preview in createPreview
        this.currentGifDataUrl = dataUrl;
        this.previewPlaceholder.classList.add('hidden');
        this.previewCanvas.classList.remove('hidden');
    }

    downloadGIF() {
        if (!this.currentGifDataUrl) {
            this.showError('No preview to download. Please create a preview first.');
            return;
        }

        try {
            const a = document.createElement('a');
            a.href = this.currentGifDataUrl;
            a.download = 'animated-gif.gif'; // GIF format for animated image
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            this.showSuccessModal();
        } catch (error) {
            this.showError(`Error downloading file: ${error.message}`);
        }
    }

    clearAll() {
        this.images = [];
        this.gif = null;
        this.gifBlob = null;
        
        // Clean up the data URL
        if (this.currentGifDataUrl) {
            URL.revokeObjectURL(this.currentGifDataUrl);
            this.currentGifDataUrl = null;
        }
        
        // Stop any running animation
        if (this.animationTimeout) {
            clearTimeout(this.animationTimeout);
            this.animationTimeout = null;
        }
        
        // Reset UI
        this.previewCanvas.classList.add('hidden');
        this.previewPlaceholder.classList.remove('hidden');
        this.imageInput.value = '';
        this.durationSlider.value = 0.5;
        this.durationValue.textContent = '0.5s';
        this.qualitySelect.value = 10;
        
        this.updateUI();
        this.hideError();
    }

    showLoading(text = 'Processing...') {
        this.loadingSpinner.classList.remove('hidden');
        this.updateLoadingText(text);
    }

    hideLoading() {
        this.loadingSpinner.classList.add('hidden');
    }

    updateLoadingText(text) {
        const loadingText = this.loadingSpinner.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }

    showSuccessModal() {
        this.successModal.classList.remove('hidden');
    }

    closeModal() {
        this.successModal.classList.add('hidden');
    }

    handleKeyboard(event) {
        // Escape key closes modal
        if (event.key === 'Escape') {
            this.closeModal();
        }
        
        // Ctrl/Cmd + Enter creates preview
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!this.previewBtn.disabled) {
                this.createPreview();
            }
        }
        
        // Ctrl/Cmd + D downloads GIF
        if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
            event.preventDefault();
            if (!this.downloadBtn.disabled) {
                this.downloadGIF();
            }
        }
        
        // Ctrl/Cmd + R clears all
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            this.clearAll();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.gifMaker = new AnimatedGIFMaker();
});

// Service Worker Registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}