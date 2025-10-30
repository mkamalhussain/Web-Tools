// Script loaded

class ImageBackgroundChanger {
    constructor() {
        this.foregroundImage = null;
        this.backgroundImage = null;
        this.canvas = null;
        this.ctx = null;
        this.isProcessing = false;
        
        this.init();
    }

    init() {
        // Get canvas element
        this.canvas = document.getElementById('preview-canvas');
        
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = 500;
        this.canvas.height = 400;
        
        // Bind event listeners
        this.bindEvents();
        
        // Draw initial placeholder
        this.drawPlaceholder();
    }

    bindEvents() {
        // File input events
        const foregroundUpload = document.getElementById('foreground-upload');
        const backgroundUpload = document.getElementById('background-upload');
        
        // Foreground upload
        foregroundUpload.addEventListener('change', (e) => this.handleForegroundUpload(e));
        
        // Background upload
        backgroundUpload.addEventListener('change', (e) => this.handleBackgroundUpload(e));
        
        // Remove button events
        document.getElementById('remove-foreground').addEventListener('click', () => {
            this.removeForegroundImage();
        });
        
        document.getElementById('remove-background').addEventListener('click', () => {
            this.removeBackgroundImage();
        });
        
        // Button events
        const previewBtn = document.getElementById('preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                if (!previewBtn.disabled) {
                    this.previewImage();
                }
            });
        }
        
        document.getElementById('download-btn').addEventListener('click', () => {
            this.downloadImage();
        });
        
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetAll();
        });
        
        // Background option events
        document.querySelectorAll('input[name="background-type"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateBackgroundOptions();
            });
        });
        
        // Color picker event
        document.getElementById('background-color').addEventListener('change', () => {
            if (document.getElementById('color-bg').checked) {
                this.previewImage();
            }
        });
        
        // Processing controls
        document.getElementById('tolerance').addEventListener('input', () => {
            this.updateSensitivityDisplay();
        });
        
        document.getElementById('edge-smoothing').addEventListener('input', () => {
            this.updateEdgeSmoothingDisplay();
        });
    }

    handleForegroundUpload(event) {
        const file = event.target.files[0];
        
        if (!file) return;
        
        if (!this.validateFile(file)) {
            this.showStatus('Please select a valid PNG or JPEG image (max 10MB)', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.foregroundImage = img;
                this.displayThumbnail('foreground-preview', img);
                this.showStatus('Foreground image loaded successfully', 'success');
                this.enablePreviewButton();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    handleBackgroundUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!this.validateFile(file)) {
            this.showError('Please upload a valid image file (PNG, JPG, JPEG) under 5MB.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.backgroundImage = img;
                this.displayThumbnail('background-preview', img);
                this.showStatus('Background image loaded successfully!');
                
                // Auto-select custom image option
                document.getElementById('image-bg').checked = true;
                this.updateBackgroundOptions();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    validateFile(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        return validTypes.includes(file.type) && file.size <= maxSize;
    }

    displayThumbnail(containerId, img) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const thumbnailImg = container.querySelector('img');
        if (thumbnailImg) {
            thumbnailImg.src = img.src;
            thumbnailImg.style.display = 'block';
            container.style.display = 'block'; // Show the container
        }
    }

    removeForegroundImage() {
        this.foregroundImage = null;
        document.getElementById('foreground-upload').value = '';
        document.getElementById('foreground-preview').style.display = 'none';
        this.enablePreviewButton();
        this.showStatus('Foreground image removed.');
    }

    removeBackgroundImage() {
        this.backgroundImage = null;
        document.getElementById('background-upload').value = '';
        document.getElementById('background-preview').style.display = 'none';
        this.showStatus('Background image removed.');
    }

    updateBackgroundOptions() {
        const customImageOption = document.getElementById('image-bg');
        const solidColorOption = document.getElementById('color-bg');
        const transparentOption = document.getElementById('transparent-bg');
        const colorPicker = document.getElementById('background-color');
        
        if (customImageOption.checked) {
            colorPicker.disabled = true;
        } else if (solidColorOption.checked) {
            colorPicker.disabled = false;
        } else {
            colorPicker.disabled = true;
        }
    }

    updateSensitivityDisplay() {
        const value = document.getElementById('tolerance').value;
        document.getElementById('tolerance-value').textContent = value;
    }

    updateEdgeSmoothingDisplay() {
        const value = document.getElementById('edge-smoothing').value;
        document.getElementById('edge-smoothing-value').textContent = value;
    }

    enablePreviewButton() {
        const previewBtn = document.getElementById('preview-btn');
        previewBtn.disabled = !this.foregroundImage;
    }

    async previewImage() {
        if (!this.foregroundImage || this.isProcessing) {
            return;
        }
        
        this.setProcessing(true);
        this.showStatus('Processing image...');
        
        try {
            // Resize image for processing
            const resizedForeground = this.resizeImage(this.foregroundImage, 800);
            
            // Remove background
            const processedImageData = await this.removeBackground(resizedForeground);
            
            // Apply new background
            const finalImage = await this.applyBackground(processedImageData, resizedForeground.width, resizedForeground.height);
            
            // Draw to canvas
            this.drawToCanvas(finalImage);
            
            this.showStatus('Preview ready! You can now download the image.');
            document.getElementById('download-btn').disabled = false;
            
        } catch (error) {
            console.error('Processing error:', error);
            this.showError('Background removal failed. Try a high-contrast image or adjust sensitivity.');
        } finally {
            this.setProcessing(false);
        }
    }

    resizeImage(img, maxWidth) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    async removeBackground(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const sensitivity = parseInt(document.getElementById('tolerance').value);
        const edgeSmoothing = parseInt(document.getElementById('edge-smoothing').value);
        
        // Simple background removal using edge detection and color thresholding
        const processedData = new Uint8ClampedArray(data);
        
        // Find dominant background color (assume corners are background)
        const bgColor = this.findBackgroundColor(data, canvas.width, canvas.height);
        console.log('🎨 Detected background color:', bgColor);
        
        // Remove background pixels with improved algorithm
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate color difference from background
            const colorDiff = Math.sqrt(
                Math.pow(r - bgColor.r, 2) +
                Math.pow(g - bgColor.g, 2) +
                Math.pow(b - bgColor.b, 2)
            );
            
            // Also check if pixel is close to white/light colors (common backgrounds)
            const whiteDiff = Math.sqrt(
                Math.pow(r - 255, 2) +
                Math.pow(g - 255, 2) +
                Math.pow(b - 255, 2)
            );
            
            // Check if pixel is close to light gray
            const lightGrayDiff = Math.sqrt(
                Math.pow(r - 240, 2) +
                Math.pow(g - 240, 2) +
                Math.pow(b - 240, 2)
            );
            
            // If pixel is similar to background color, white, or light gray, make it transparent
            if (colorDiff < sensitivity || whiteDiff < sensitivity * 0.8 || lightGrayDiff < sensitivity * 0.6) {
                processedData[i + 3] = 0; // Set alpha to 0 (transparent)
            }
        }
        
        // Apply edge smoothing
        if (edgeSmoothing > 0) {
            this.smoothEdges(processedData, canvas.width, canvas.height, edgeSmoothing);
        }
        
        const result = new ImageData(processedData, canvas.width, canvas.height);
        return result;
    }

    findBackgroundColor(data, width, height) {
        // Sample edge pixels more comprehensively
        const edgePixels = [];
        
        // Top and bottom edges
        for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 20))) {
            // Top edge
            let index = x * 4;
            edgePixels.push({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            });
            
            // Bottom edge
            index = ((height - 1) * width + x) * 4;
            edgePixels.push({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            });
        }
        
        // Left and right edges
        for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 20))) {
            // Left edge
            let index = (y * width) * 4;
            edgePixels.push({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            });
            
            // Right edge
            index = (y * width + width - 1) * 4;
            edgePixels.push({
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            });
        }
        
        // Find the most common color among edge pixels
        const colorCounts = {};
        edgePixels.forEach(pixel => {
            // Group similar colors together (reduce precision)
            const key = `${Math.floor(pixel.r / 10) * 10},${Math.floor(pixel.g / 10) * 10},${Math.floor(pixel.b / 10) * 10}`;
            colorCounts[key] = (colorCounts[key] || 0) + 1;
        });
        
        // Find the most frequent color
        let maxCount = 0;
        let dominantColor = { r: 255, g: 255, b: 255 };
        
        for (const [colorKey, count] of Object.entries(colorCounts)) {
            if (count > maxCount) {
                maxCount = count;
                const [r, g, b] = colorKey.split(',').map(Number);
                dominantColor = { r, g, b };
            }
        }
        
        return dominantColor;
    }

    smoothEdges(data, width, height, smoothing) {
        const tempData = new Uint8ClampedArray(data);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const index = (y * width + x) * 4;
                
                if (data[index + 3] > 0 && data[index + 3] < 255) {
                    // This is an edge pixel, apply smoothing
                    let alphaSum = 0;
                    let count = 0;
                    
                    for (let dy = -smoothing; dy <= smoothing; dy++) {
                        for (let dx = -smoothing; dx <= smoothing; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nIndex = (ny * width + nx) * 4;
                                alphaSum += data[nIndex + 3];
                                count++;
                            }
                        }
                    }
                    
                    tempData[index + 3] = Math.round(alphaSum / count);
                }
            }
        }
        
        data.set(tempData);
    }

    async applyBackground(processedImageData, width, height) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        // Apply background based on selected option
        const transparentOption = document.getElementById('transparent-bg');
        const solidColorOption = document.getElementById('color-bg');
        const customImageOption = document.getElementById('image-bg');
        
        if (transparentOption.checked) {
            // Transparent background - just draw the processed image
            ctx.putImageData(processedImageData, 0, 0);
        } else {
            // First, apply the background
            if (solidColorOption.checked) {
                // Solid color background
                const color = document.getElementById('background-color').value;
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, width, height);
            } else if (customImageOption.checked && this.backgroundImage) {
                // Custom image background
                ctx.drawImage(this.backgroundImage, 0, 0, width, height);
            } else {
                // Default to white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
            }
            
            // Then, create a temporary canvas for the processed image and composite it
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = width;
            tempCanvas.height = height;
            tempCtx.putImageData(processedImageData, 0, 0);
            
            // Composite the processed image over the background
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(tempCanvas, 0, 0);
        }
        
        return canvas;
    }

    drawToCanvas(sourceCanvas) {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Calculate scaling to fit the canvas while maintaining aspect ratio
        const scale = Math.min(
            this.canvas.width / sourceCanvas.width,
            this.canvas.height / sourceCanvas.height
        );
        
        const scaledWidth = sourceCanvas.width * scale;
        const scaledHeight = sourceCanvas.height * scale;
        
        // Center the image
        const x = (this.canvas.width - scaledWidth) / 2;
        const y = (this.canvas.height - scaledHeight) / 2;
        
        // Draw the image
        this.ctx.drawImage(sourceCanvas, x, y, scaledWidth, scaledHeight);
        
        // Show the canvas
        this.showCanvas();
    }

    showCanvas() {
        this.canvas.style.display = 'block';
        const placeholder = document.getElementById('canvas-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }

    hideCanvas() {
        this.canvas.style.display = 'none';
        const placeholder = document.getElementById('canvas-placeholder');
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
    }

    drawPlaceholder() {
        // Hide the canvas and show the placeholder
        this.canvas.style.display = 'none';
        const placeholder = document.getElementById('canvas-placeholder');
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        console.log('Canvas hidden, placeholder shown');
    }

    downloadImage() {
        if (!this.canvas) return;
        
        // Create a download link
        this.canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'edited-image.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatus('Image downloaded successfully!');
        }, 'image/png');
    }

    resetAll() {
        // Clear images
        this.foregroundImage = null;
        this.backgroundImage = null;
        
        // Reset file inputs
        document.getElementById('foreground-upload').value = '';
        document.getElementById('background-upload').value = '';
        
        // Clear previews
        const foregroundPreview = document.getElementById('foreground-preview');
        const backgroundPreview = document.getElementById('background-preview');
        foregroundPreview.style.display = 'none';
        backgroundPreview.style.display = 'none';
        
        // Reset options
        document.getElementById('transparent-bg').checked = true;
        this.updateBackgroundOptions();
        
        // Reset controls
        document.getElementById('tolerance').value = 30;
        document.getElementById('edge-smoothing').value = 2;
        this.updateSensitivityDisplay();
        this.updateEdgeSmoothingDisplay();
        
        // Reset buttons
        document.getElementById('preview-btn').disabled = true;
        document.getElementById('download-btn').disabled = true;
        
        // Clear canvas
        this.drawPlaceholder();
        
        // Clear status
        this.showStatus('All settings reset. Upload a new image to start.');
    }

    setProcessing(isProcessing) {
        this.isProcessing = isProcessing;
        const spinner = document.getElementById('loading-spinner');
        const previewBtn = document.getElementById('preview-btn');
        
        if (isProcessing) {
            spinner.style.display = 'block';
            previewBtn.disabled = true;
        } else {
            spinner.style.display = 'none';
            previewBtn.disabled = !this.foregroundImage;
        }
    }

    showStatus(message) {
        const statusElement = document.getElementById('status-messages');
        if (!statusElement) {
            console.error('Status element not found!');
            return;
        }
        statusElement.textContent = message;
        statusElement.className = 'status-message success';
        
        // Clear after 5 seconds
        setTimeout(() => {
            if (statusElement) {
                statusElement.textContent = '';
                statusElement.className = 'status-message';
            }
        }, 5000);
    }

    showError(message) {
        const statusElement = document.getElementById('status-messages');
        if (!statusElement) {
            console.error('Status element not found!');
            return;
        }
        statusElement.textContent = message;
        statusElement.className = 'status-message error';
        
        // Clear after 7 seconds
        setTimeout(() => {
            if (statusElement) {
                statusElement.textContent = '';
                statusElement.className = 'status-message';
            }
        }, 7000);
    }
}

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    const app = new ImageBackgroundChanger();
});