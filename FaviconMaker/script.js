class FaviconMaker {
    constructor() {
        this.currentStep = 1;
        this.originalImage = null;
        this.croppedImage = null;
        this.cropData = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };
        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = { x: 0, y: 0 };
        this.resizeHandle = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showStep(1);
    }

    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('upload-area');

        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Only allow clicking on the upload area itself, not the button
        uploadArea.addEventListener('click', (e) => {
            // Don't trigger file input if clicking on the button
            if (!e.target.closest('button')) {
                fileInput.click();
            }
        });

        // Crop controls
        document.getElementById('reset-crop-btn').addEventListener('click', () => this.resetCrop());
        document.getElementById('apply-crop-btn').addEventListener('click', () => this.applyCrop());

        // Navigation
        document.getElementById('back-to-crop-btn').addEventListener('click', () => this.showStep(2));
        document.getElementById('generate-favicons-btn').addEventListener('click', () => this.generateFavicons());
        document.getElementById('start-over-btn').addEventListener('click', () => this.startOver());

        // Download
        document.getElementById('download-zip-btn').addEventListener('click', () => this.downloadZip());
        document.getElementById('copy-html-btn').addEventListener('click', () => this.copyHtmlCode());
    }

    // File Upload Functionality
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
            // Clear the input value to allow selecting the same file again if needed
            event.target.value = '';
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragover');
    }

    handleDragLeave(event) {
        event.currentTarget.classList.remove('dragover');
    }

    handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    processFile(file) {
        console.log('Processing file:', file.name, file.type, file.size);
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showStatus('Please select a valid image file.', 'error');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showStatus('File size must be less than 10MB.', 'error');
            return;
        }

        this.showStatus('Loading image...', 'info');

        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('FileReader loaded, creating image...');
            const img = new Image();
            img.onload = () => {
                console.log('Image loaded successfully:', img.width, 'x', img.height);
                this.originalImage = img;
                this.showStep(2);
                console.log('Called showStep(2) - should now be on crop step');
                
                // Wait for CSS transition to complete before setting up crop interface
                setTimeout(() => {
                    this.setupCropInterface();
                    this.showStatus('Image loaded successfully!', 'success');
                }, 100);
            };
            img.onerror = () => {
                console.error('Failed to load image');
                this.showStatus('Failed to load image. Please try another file.', 'error');
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            console.error('FileReader error');
            this.showStatus('Failed to read file.', 'error');
        };
        reader.readAsDataURL(file);
    }

    // Crop Interface
    setupCropInterface() {
        console.log('Setting up crop interface...');
        const canvas = document.getElementById('crop-canvas');
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        
        console.log('Canvas element:', canvas);
        console.log('Container element:', container);
        console.log('Container dimensions:', container.clientWidth, 'x', container.clientHeight);

        // Calculate canvas size to fit container while maintaining aspect ratio
        const containerWidth = container.clientWidth - 40;
        const containerHeight = 500;
        
        console.log('Available space:', containerWidth, 'x', containerHeight);
        console.log('Original image size:', this.originalImage.width, 'x', this.originalImage.height);
        
        const imgAspect = this.originalImage.width / this.originalImage.height;
        let canvasWidth, canvasHeight;

        if (imgAspect > containerWidth / containerHeight) {
            canvasWidth = Math.min(containerWidth, this.originalImage.width);
            canvasHeight = canvasWidth / imgAspect;
        } else {
            canvasHeight = Math.min(containerHeight, this.originalImage.height);
            canvasWidth = canvasHeight * imgAspect;
        }

        console.log('Calculated canvas size:', canvasWidth, 'x', canvasHeight);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        console.log('Canvas after sizing:', canvas.width, 'x', canvas.height);
        console.log('Canvas style:', getComputedStyle(canvas).display, getComputedStyle(canvas).visibility);

        // Draw image
        ctx.drawImage(this.originalImage, 0, 0, canvasWidth, canvasHeight);
        console.log('Image drawn to canvas');

        // Initialize crop selection (square in center)
        const size = Math.min(canvasWidth, canvasHeight) * 0.6;
        this.cropData = {
            x: (canvasWidth - size) / 2,
            y: (canvasHeight - size) / 2,
            width: size,
            height: size
        };

        console.log('Crop data initialized:', this.cropData);

        this.updateCropSelection();
        this.updateCropPreview();
        this.setupCropInteraction();
        
        console.log('Crop interface setup complete');
    }

    setupCropInteraction() {
        const cropSelection = document.getElementById('crop-selection');
        const handles = cropSelection.querySelectorAll('.crop-handle');

        // Selection dragging
        cropSelection.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('crop-handle')) return;
            this.isDragging = true;
            
            // Calculate canvas offset within container
            const canvas = document.getElementById('crop-canvas');
            const container = canvas.parentElement;
            const containerRect = container.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            const canvasOffsetX = canvasRect.left - containerRect.left;
            const canvasOffsetY = canvasRect.top - containerRect.top;
            
            // Store drag start relative to canvas coordinates
            this.dragStart = {
                x: e.clientX - canvasOffsetX - this.cropData.x,
                y: e.clientY - canvasOffsetY - this.cropData.y,
                canvasOffsetX: canvasOffsetX,
                canvasOffsetY: canvasOffsetY
            };
            e.preventDefault();
        });

        // Handle resizing
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                this.isResizing = true;
                this.resizeHandle = handle.className.split(' ')[1];
                
                // Calculate canvas offset within container
                const canvas = document.getElementById('crop-canvas');
                const container = canvas.parentElement;
                const containerRect = container.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                const canvasOffsetX = canvasRect.left - containerRect.left;
                const canvasOffsetY = canvasRect.top - containerRect.top;
                
                this.dragStart = {
                    x: e.clientX,
                    y: e.clientY,
                    cropX: this.cropData.x,
                    cropY: this.cropData.y,
                    cropWidth: this.cropData.width,
                    cropHeight: this.cropData.height,
                    canvasOffsetX: canvasOffsetX,
                    canvasOffsetY: canvasOffsetY
                };
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Mouse move and up events
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
    }

    handleMouseMove(event) {
        if (this.isDragging) {
            const canvas = document.getElementById('crop-canvas');
            
            // Calculate new position using stored canvas offset
            let newX = event.clientX - this.dragStart.canvasOffsetX - this.dragStart.x;
            let newY = event.clientY - this.dragStart.canvasOffsetY - this.dragStart.y;

            // Constrain to canvas bounds
            newX = Math.max(0, Math.min(newX, canvas.width - this.cropData.width));
            newY = Math.max(0, Math.min(newY, canvas.height - this.cropData.height));

            this.cropData.x = newX;
            this.cropData.y = newY;

            this.updateCropSelection();
            this.updateCropPreview();
        } else if (this.isResizing) {
            this.handleResize(event);
        }
    }

    handleResize(event) {
        const canvas = document.getElementById('crop-canvas');
        const deltaX = event.clientX - this.dragStart.x;
        const deltaY = event.clientY - this.dragStart.y;

        let newX = this.dragStart.cropX;
        let newY = this.dragStart.cropY;
        let newWidth = this.dragStart.cropWidth;
        let newHeight = this.dragStart.cropHeight;

        switch (this.resizeHandle) {
            case 'top-left':
                newX = this.dragStart.cropX + deltaX;
                newY = this.dragStart.cropY + deltaY;
                newWidth = this.dragStart.cropWidth - deltaX;
                newHeight = this.dragStart.cropHeight - deltaY;
                break;
            case 'top-right':
                newY = this.dragStart.cropY + deltaY;
                newWidth = this.dragStart.cropWidth + deltaX;
                newHeight = this.dragStart.cropHeight - deltaY;
                break;
            case 'bottom-left':
                newX = this.dragStart.cropX + deltaX;
                newWidth = this.dragStart.cropWidth - deltaX;
                newHeight = this.dragStart.cropHeight + deltaY;
                break;
            case 'bottom-right':
                newWidth = this.dragStart.cropWidth + deltaX;
                newHeight = this.dragStart.cropHeight + deltaY;
                break;
        }

        // Maintain square aspect ratio
        const size = Math.min(newWidth, newHeight);
        newWidth = newHeight = size;

        // Adjust position if needed
        if (this.resizeHandle.includes('left')) {
            newX = this.dragStart.cropX + this.dragStart.cropWidth - size;
        }
        if (this.resizeHandle.includes('top')) {
            newY = this.dragStart.cropY + this.dragStart.cropHeight - size;
        }

        // Constrain to canvas bounds
        const minSize = 50;
        if (size >= minSize && newX >= 0 && newY >= 0 && 
            newX + size <= canvas.width && newY + size <= canvas.height) {
            this.cropData.x = newX;
            this.cropData.y = newY;
            this.cropData.width = size;
            this.cropData.height = size;

            this.updateCropSelection();
            this.updateCropPreview();
        }
    }

    handleMouseUp() {
        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandle = null;
    }

    updateCropSelection() {
        const selection = document.getElementById('crop-selection');
        const canvas = document.getElementById('crop-canvas');
        const container = canvas.parentElement; // crop-canvas-container
        
        console.log('Updating crop selection:', this.cropData);
        console.log('Selection element:', selection);
        
        // Calculate canvas offset within its container
        const containerRect = container.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        const canvasOffsetX = canvasRect.left - containerRect.left;
        const canvasOffsetY = canvasRect.top - containerRect.top;
        
        console.log('Canvas offset within container:', canvasOffsetX, canvasOffsetY);
        console.log('Container size:', containerRect.width, containerRect.height);
        console.log('Canvas size:', canvasRect.width, canvasRect.height);
        
        // Position crop selection relative to container, accounting for canvas offset
        const selectionX = canvasOffsetX + this.cropData.x;
        const selectionY = canvasOffsetY + this.cropData.y;
        
        selection.style.left = selectionX + 'px';
        selection.style.top = selectionY + 'px';
        selection.style.width = this.cropData.width + 'px';
        selection.style.height = this.cropData.height + 'px';
        
        console.log('Selection positioned at:', selection.style.left, selection.style.top, selection.style.width, selection.style.height);
        console.log('Selection computed style:', getComputedStyle(selection).display, getComputedStyle(selection).visibility);
    }

    updateCropPreview() {
        const canvas = document.getElementById('crop-canvas');
        const previewCanvas = document.getElementById('crop-preview-canvas');
        const previewCtx = previewCanvas.getContext('2d');

        // Calculate source coordinates on original image
        const scaleX = this.originalImage.width / canvas.width;
        const scaleY = this.originalImage.height / canvas.height;

        const sourceX = this.cropData.x * scaleX;
        const sourceY = this.cropData.y * scaleY;
        const sourceWidth = this.cropData.width * scaleX;
        const sourceHeight = this.cropData.height * scaleY;

        // Clear and draw preview
        previewCtx.clearRect(0, 0, 128, 128);
        previewCtx.drawImage(
            this.originalImage,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, 128, 128
        );
    }

    resetCrop() {
        const canvas = document.getElementById('crop-canvas');
        const size = Math.min(canvas.width, canvas.height) * 0.6;
        
        this.cropData = {
            x: (canvas.width - size) / 2,
            y: (canvas.height - size) / 2,
            width: size,
            height: size
        };

        this.updateCropSelection();
        this.updateCropPreview();
    }

    applyCrop() {
        // Create cropped image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to crop size
        canvas.width = 512;
        canvas.height = 512;

        // Calculate source coordinates
        const sourceCanvas = document.getElementById('crop-canvas');
        const scaleX = this.originalImage.width / sourceCanvas.width;
        const scaleY = this.originalImage.height / sourceCanvas.height;

        const sourceX = this.cropData.x * scaleX;
        const sourceY = this.cropData.y * scaleY;
        const sourceWidth = this.cropData.width * scaleX;
        const sourceHeight = this.cropData.height * scaleY;

        // Draw cropped image at high resolution
        ctx.drawImage(
            this.originalImage,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, 512, 512
        );

        // Convert to image
        const img = new Image();
        img.onload = () => {
            this.croppedImage = img;
            this.generatePreviews();
            this.showStep(3);
        };
        img.src = canvas.toDataURL('image/png');
    }

    // Preview Generation
    generatePreviews() {
        const sizes = [16, 32, 48, 64, 128, 180];
        
        sizes.forEach(size => {
            const canvas = document.querySelector(`[data-size="${size}"]`);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, size, size);
                ctx.drawImage(this.croppedImage, 0, 0, size, size);
            }
        });

        // Browser tab preview
        const tabFavicon = document.querySelector('.tab-favicon');
        if (tabFavicon) {
            const ctx = tabFavicon.getContext('2d');
            ctx.clearRect(0, 0, 16, 16);
            ctx.drawImage(this.croppedImage, 0, 0, 16, 16);
        }
    }

    // Favicon Generation and Download
    async generateFavicons() {
        this.showStatus('Generating favicon files...', 'info');

        try {
            // Generate all favicon files
            const files = await this.createFaviconFiles();
            
            // Generate HTML code
            const htmlCode = this.generateHtmlCode();
            document.getElementById('html-code').textContent = htmlCode;

            this.faviconFiles = files;
            this.showStep(4);
            this.showStatus('Favicons generated successfully!', 'success');
        } catch (error) {
            console.error('Error generating favicons:', error);
            this.showStatus('Error generating favicons. Please try again.', 'error');
        }
    }

    async createFaviconFiles() {
        const files = {};

        // Generate PNG files
        const sizes = [16, 32, 48, 64, 128, 180];
        
        for (const size of sizes) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;
            
            ctx.drawImage(this.croppedImage, 0, 0, size, size);
            
            const blob = await this.canvasToBlob(canvas);
            
            if (size === 180) {
                files['apple-touch-icon.png'] = blob;
            } else {
                files[`favicon-${size}x${size}.png`] = blob;
            }
        }

        // Generate ICO file (multi-resolution)
        const icoBlob = await this.generateIcoFile();
        files['favicon.ico'] = icoBlob;

        // Generate manifest.json
        const manifest = {
            "name": "Your Website",
            "short_name": "Website",
            "icons": [
                {
                    "src": "/favicon-32x32.png",
                    "sizes": "32x32",
                    "type": "image/png"
                },
                {
                    "src": "/favicon-48x48.png",
                    "sizes": "48x48",
                    "type": "image/png"
                },
                {
                    "src": "/apple-touch-icon.png",
                    "sizes": "180x180",
                    "type": "image/png"
                }
            ],
            "theme_color": "#ffffff",
            "background_color": "#ffffff",
            "display": "standalone"
        };

        files['manifest.json'] = new Blob([JSON.stringify(manifest, null, 2)], {
            type: 'application/json'
        });

        return files;
    }

    async generateIcoFile() {
        // Simple ICO generation - create a basic ICO with 16x16 and 32x32
        const sizes = [16, 32];
        const images = [];

        for (const size of sizes) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;
            
            ctx.drawImage(this.croppedImage, 0, 0, size, size);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, size, size);
            images.push({
                width: size,
                height: size,
                data: imageData.data
            });
        }

        // Create ICO file structure
        return this.createIcoBlob(images);
    }

    createIcoBlob(images) {
        // ICO file format implementation
        const iconCount = images.length;
        let offset = 6 + (iconCount * 16); // Header + directory entries
        
        // Calculate total size
        let totalSize = offset;
        const imageDataArray = [];
        
        for (const img of images) {
            // Convert RGBA to PNG-like data for ICO
            const pngData = this.createPngDataForIco(img);
            imageDataArray.push(pngData);
            totalSize += pngData.length;
        }

        // Create buffer
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        
        // ICO header
        view.setUint16(0, 0, true); // Reserved
        view.setUint16(2, 1, true); // Type (1 = ICO)
        view.setUint16(4, iconCount, true); // Number of images
        
        // Directory entries
        let currentOffset = offset;
        for (let i = 0; i < iconCount; i++) {
            const img = images[i];
            const entryOffset = 6 + (i * 16);
            
            view.setUint8(entryOffset, img.width === 256 ? 0 : img.width);
            view.setUint8(entryOffset + 1, img.height === 256 ? 0 : img.height);
            view.setUint8(entryOffset + 2, 0); // Color palette
            view.setUint8(entryOffset + 3, 0); // Reserved
            view.setUint16(entryOffset + 4, 1, true); // Color planes
            view.setUint16(entryOffset + 6, 32, true); // Bits per pixel
            view.setUint32(entryOffset + 8, imageDataArray[i].length, true); // Size
            view.setUint32(entryOffset + 12, currentOffset, true); // Offset
            
            currentOffset += imageDataArray[i].length;
        }
        
        // Image data
        currentOffset = offset;
        for (const imgData of imageDataArray) {
            uint8View.set(imgData, currentOffset);
            currentOffset += imgData.length;
        }
        
        return new Blob([buffer], { type: 'image/x-icon' });
    }

    createPngDataForIco(img) {
        // Simplified PNG creation for ICO
        // In a real implementation, you'd want to use a proper PNG encoder
        // For now, we'll create a basic bitmap structure
        
        const width = img.width;
        const height = img.height;
        const data = img.data;
        
        // Create a simple bitmap header + data
        const headerSize = 40; // BITMAPINFOHEADER
        const imageSize = width * height * 4; // RGBA
        const totalSize = headerSize + imageSize;
        
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        
        // BITMAPINFOHEADER
        view.setUint32(0, headerSize, true); // Header size
        view.setInt32(4, width, true); // Width
        view.setInt32(8, height * 2, true); // Height (doubled for ICO)
        view.setUint16(12, 1, true); // Planes
        view.setUint16(14, 32, true); // Bits per pixel
        view.setUint32(16, 0, true); // Compression
        view.setUint32(20, imageSize, true); // Image size
        view.setInt32(24, 0, true); // X pixels per meter
        view.setInt32(28, 0, true); // Y pixels per meter
        view.setUint32(32, 0, true); // Colors used
        view.setUint32(36, 0, true); // Important colors
        
        // Image data (flip vertically for bitmap format)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcIndex = ((height - 1 - y) * width + x) * 4;
                const dstIndex = headerSize + (y * width + x) * 4;
                
                uint8View[dstIndex] = data[srcIndex + 2]; // B
                uint8View[dstIndex + 1] = data[srcIndex + 1]; // G
                uint8View[dstIndex + 2] = data[srcIndex]; // R
                uint8View[dstIndex + 3] = data[srcIndex + 3]; // A
            }
        }
        
        return uint8View;
    }

    canvasToBlob(canvas) {
        return new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
        });
    }

    generateHtmlCode() {
        return `<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

<!-- Web App Manifest -->
<link rel="manifest" href="/manifest.json">

<!-- Theme Color -->
<meta name="theme-color" content="#ffffff">`;
    }

    async downloadZip() {
        if (!this.faviconFiles) {
            this.showStatus('Please generate favicons first.', 'error');
            return;
        }

        this.showStatus('Creating ZIP file...', 'info');

        try {
            const zip = new JSZip();

            // Add all favicon files
            for (const [filename, blob] of Object.entries(this.faviconFiles)) {
                zip.file(filename, blob);
            }

            // Add HTML implementation file
            const htmlCode = this.generateHtmlCode();
            zip.file('favicon-implementation.html', htmlCode);

            // Generate and download ZIP
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            this.downloadBlob(zipBlob, 'favicons.zip');

            this.showStatus('ZIP file downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error creating ZIP:', error);
            this.showStatus('Error creating ZIP file.', 'error');
        }
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    copyHtmlCode() {
        const htmlCode = document.getElementById('html-code').textContent;
        navigator.clipboard.writeText(htmlCode).then(() => {
            this.showStatus('HTML code copied to clipboard!', 'success');
        }).catch(() => {
            this.showStatus('Failed to copy HTML code.', 'error');
        });
    }

    // Navigation and UI
    showStep(step) {
        console.log(`showStep(${step}) called`);
        
        // Update progress steps
        document.querySelectorAll('.step').forEach((el, index) => {
            el.classList.remove('active', 'completed');
            if (index + 1 < step) {
                el.classList.add('completed');
            } else if (index + 1 === step) {
                el.classList.add('active');
            }
        });

        // Show/hide sections
        const sections = document.querySelectorAll('.section');
        console.log(`Found ${sections.length} sections`);
        
        sections.forEach((el, index) => {
            console.log(`Section ${index + 1}: ${el.id}, current classes: ${el.className}`);
            el.classList.remove('active', 'fade-in');
            if (index + 1 === step) {
                el.classList.add('active', 'fade-in');
                console.log(`Activated section ${index + 1}: ${el.id}, new classes: ${el.className}`);
                console.log(`Section display style: ${getComputedStyle(el).display}`);
            }
        });

        this.currentStep = step;
        console.log(`Current step set to: ${this.currentStep}`);
    }

    startOver() {
        this.originalImage = null;
        this.croppedImage = null;
        this.faviconFiles = null;
        document.getElementById('file-input').value = '';
        this.showStep(1);
        this.showStatus('Ready to create a new favicon!', 'info');
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type} show`;

        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 3000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new FaviconMaker();
});