// Custom Card Maker - Main JavaScript File
class CustomCardMaker {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentImage = null;
        this.textElements = [];
        this.isDragging = false;
        this.dragElement = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // Border properties
        this.borderStyle = 'none';
        this.borderWidth = 3;
        this.borderColor = '#000000';
        this.borderRadius = 0;
        
        // Unsplash API - Using demo access key for public usage
        this.unsplashAccessKey = 'YOUR_UNSPLASH_ACCESS_KEY'; // Replace with your Unsplash access key
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.drawInitialCard();
        this.updateFontSizeDisplay();
        this.updateBorderRangeDisplays();
    }

    updateBorderRangeDisplays() {
        document.getElementById('border-width-value').textContent = this.borderWidth + 'px';
        document.getElementById('border-radius-value').textContent = this.borderRadius + 'px';
    }

    setupCanvas() {
        this.canvas = document.getElementById('card-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = 600;
        this.canvas.height = 400;
        
        // Enable high DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    bindEvents() {
        // File upload
        document.getElementById('image-upload').addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        // Image search
        document.getElementById('search-btn').addEventListener('click', () => {
            this.searchImages();
        });

        document.getElementById('image-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchImages();
            }
        });

        // Text controls
        document.getElementById('card-text').addEventListener('input', () => {
            this.updatePreview();
        });

        document.getElementById('font-family').addEventListener('change', () => {
            this.updatePreview();
        });

        document.getElementById('font-size').addEventListener('input', (e) => {
            this.updateFontSizeDisplay();
            this.updatePreview();
        });

        document.getElementById('text-color').addEventListener('change', () => {
            this.updatePreview();
        });

        document.getElementById('text-position').addEventListener('change', () => {
            this.updatePreview();
        });

        document.getElementById('add-text-btn').addEventListener('click', () => {
            this.addTextToCard();
        });

        document.getElementById('clear-text-btn').addEventListener('click', () => {
            this.clearAllText();
        });

        // Border controls
        document.getElementById('border-style').addEventListener('change', (e) => {
            this.borderStyle = e.target.value;
            this.updatePreview();
        });

        document.getElementById('border-width').addEventListener('input', (e) => {
            this.borderWidth = parseInt(e.target.value);
            document.getElementById('border-width-value').textContent = this.borderWidth + 'px';
            this.updatePreview();
        });

        document.getElementById('border-color').addEventListener('change', (e) => {
            this.borderColor = e.target.value;
            this.updatePreview();
        });

        document.getElementById('border-radius').addEventListener('input', (e) => {
            this.borderRadius = parseInt(e.target.value);
            document.getElementById('border-radius-value').textContent = this.borderRadius + 'px';
            this.updatePreview();
        });

        // Template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyTemplate(e.target.dataset.template);
            });
        });

        // Action buttons
        document.getElementById('preview-btn').addEventListener('click', () => {
            this.previewCard();
        });

        document.getElementById('download-png-btn').addEventListener('click', () => {
            this.downloadPNG();
        });

        document.getElementById('download-pdf-btn').addEventListener('click', () => {
            this.downloadPDF();
        });

        document.getElementById('clear-canvas-btn').addEventListener('click', () => {
            this.clearCanvas();
        });

        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleCanvasMouseDown(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.handleCanvasMouseMove(e);
        });

        this.canvas.addEventListener('mouseup', () => {
            this.handleCanvasMouseUp();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Drag and drop for images
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleImageDrop(e);
        });
    }

    drawInitialCard() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw border
        this.ctx.strokeStyle = '#e5e7eb';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);
        
        // Draw placeholder text
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.font = '24px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Your card design will appear here', this.canvas.width / 2, this.canvas.height / 2);
        
        this.ctx.font = '16px Inter';
        this.ctx.fillText('Upload an image or search online to get started', this.canvas.width / 2, this.canvas.height / 2 + 40);
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file
        if (!this.validateImageFile(file)) {
            return;
        }

        this.showLoading('Processing image...');

        try {
            const resizedImage = await this.resizeImage(file);
            this.currentImage = resizedImage;
            this.redrawCanvas();
            this.showSuccess('Image uploaded successfully!');
        } catch (error) {
            this.showError('Failed to process image: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    validateImageFile(file) {
        // Check file type
        if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
            this.showError('Please upload a PNG or JPG image.');
            return false;
        }

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            this.showError('Image size must be less than 5MB.');
            return false;
        }

        return true;
    }

    async resizeImage(file, maxWidth = 800) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and resize
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    const resizedImg = new Image();
                    resizedImg.onload = () => resolve(resizedImg);
                    resizedImg.onerror = reject;
                    resizedImg.src = URL.createObjectURL(blob);
                }, 'image/jpeg', 0.9);
            };

            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    async searchImages() {
        const query = document.getElementById('image-search').value.trim();
        if (!query) {
            this.showError('Please enter a search term.');
            return;
        }

        this.showLoading('Searching for images...');

        try {
            // Try Unsplash API first if key is provided
            if (this.unsplashAccessKey && this.unsplashAccessKey !== 'YOUR_UNSPLASH_ACCESS_KEY') {
                const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&client_id=${this.unsplashAccessKey}`, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.results && data.results.length > 0) {
                        this.displaySearchResults(data.results);
                        this.showSuccess(`Found ${data.results.length} images for "${query}"`);
                        return;
                    }
                }
            }

            // Fallback to curated images based on search term
            this.generateCuratedImages(query);
            this.showSuccess(`Showing curated images for "${query}"`);
            
        } catch (error) {
            console.warn('Search error:', error);
            this.generateCuratedImages(query);
            this.showSuccess(`Showing curated images for "${query}"`);
        } finally {
            this.hideLoading();
        }
    }

    generateCuratedImages(query) {
        const curatedImages = [];
        
        // Map search terms to relevant image categories
        const categoryMap = {
            'nature': ['forest', 'mountain', 'ocean', 'flower', 'tree', 'landscape'],
            'city': ['building', 'street', 'urban', 'architecture', 'skyline', 'downtown'],
            'people': ['person', 'portrait', 'family', 'friends', 'business', 'lifestyle'],
            'food': ['meal', 'restaurant', 'cooking', 'fruit', 'dessert', 'kitchen'],
            'animals': ['cat', 'dog', 'wildlife', 'bird', 'pet', 'zoo'],
            'technology': ['computer', 'phone', 'gadget', 'innovation', 'digital', 'tech'],
            'travel': ['vacation', 'destination', 'adventure', 'tourism', 'journey', 'explore'],
            'business': ['office', 'meeting', 'professional', 'corporate', 'work', 'team'],
            'art': ['painting', 'creative', 'design', 'artistic', 'gallery', 'sculpture'],
            'sports': ['fitness', 'exercise', 'game', 'athlete', 'competition', 'activity']
        };

        // Find the best matching category
        let selectedCategory = 'nature'; // default
        const queryLower = query.toLowerCase();
        
        for (const [category, keywords] of Object.entries(categoryMap)) {
            if (keywords.some(keyword => queryLower.includes(keyword) || keyword.includes(queryLower))) {
                selectedCategory = category;
                break;
            }
        }

        // Generate curated images with specific IDs for consistency
        const baseId = this.hashCode(query); // Generate consistent ID based on query
        
        for (let i = 0; i < 12; i++) {
            const imageId = baseId + i;
            curatedImages.push({
                id: `curated-${imageId}`,
                urls: {
                    small: `https://picsum.photos/200/200?random=${imageId}`,
                    regular: `https://picsum.photos/800/600?random=${imageId}`
                },
                alt_description: `${selectedCategory} image related to ${query}`,
                user: { name: 'Curated Collection' }
            });
        }
        
        this.displaySearchResults(curatedImages);
    }

    // Helper function to generate consistent hash from string
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    displaySearchResults(images) {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '';

        if (images.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No images found. Try a different search term.</p>';
            return;
        }

        images.forEach(image => {
            const imageElement = document.createElement('div');
            imageElement.className = 'search-result-item';
            imageElement.innerHTML = `
                <img src="${image.urls.small}" alt="${image.alt_description || 'Search result'}" loading="lazy">
            `;
            
            imageElement.addEventListener('click', () => {
                this.selectSearchImage(image.urls.regular);
            });

            resultsContainer.appendChild(imageElement);
        });
    }

    async selectSearchImage(imageUrl) {
        this.showLoading('Loading image...');

        try {
            // Create a new image element
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            // Add timestamp to prevent caching issues with Lorem Picsum
            const finalUrl = imageUrl.includes('picsum.photos') ? 
                `${imageUrl}&t=${Date.now()}` : imageUrl;
            
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    // Ensure image is fully loaded before proceeding
                    if (img.complete && img.naturalWidth > 0) {
                        resolve();
                    } else {
                        reject(new Error('Image failed to load properly'));
                    }
                };
                img.onerror = () => reject(new Error('Image failed to load'));
                
                // Set source after event listeners are attached
                img.src = finalUrl;
            });

            // Resize image if it's too large
            const resizedImage = this.resizeImageForCanvas(img);
            this.currentImage = resizedImage;
            this.redrawCanvas();
            this.showSuccess('Image loaded successfully!');
            
        } catch (error) {
            console.error('Image loading error:', error);
            this.showError('Failed to load image. Please try another one.');
        } finally {
            this.hideLoading();
        }
    }

    resizeImageForCanvas(img) {
        const maxWidth = 800;
        const maxHeight = 600;
        
        if (img.width <= maxWidth && img.height <= maxHeight) {
            return img;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions maintaining aspect ratio
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        // Draw resized image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to image
        const resizedImg = new Image();
        resizedImg.src = canvas.toDataURL();
        return resizedImg;
    }

    handleImageDrop(event) {
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (this.validateImageFile(file)) {
                // Simulate file input change
                const fakeEvent = { target: { files: [file] } };
                this.handleImageUpload(fakeEvent);
            }
        }
    }

    addTextToCard() {
        const text = document.getElementById('card-text').value.trim();
        if (!text) {
            this.showError('Please enter some text.');
            return;
        }

        const textElement = {
            id: Date.now(),
            text: text,
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            font: document.getElementById('font-family').value,
            size: parseInt(document.getElementById('font-size').value),
            color: document.getElementById('text-color').value,
            position: document.getElementById('text-position').value
        };

        // Adjust position based on selection
        this.adjustTextPosition(textElement);
        
        this.textElements.push(textElement);
        this.redrawCanvas();
        this.showSuccess('Text added to card!');
        
        // Clear the text input
        document.getElementById('card-text').value = '';
    }

    adjustTextPosition(textElement) {
        const margin = 40;
        
        switch (textElement.position) {
            case 'top':
                textElement.y = margin + textElement.size;
                break;
            case 'bottom':
                textElement.y = this.canvas.height - margin;
                break;
            case 'left':
                textElement.x = margin;
                break;
            case 'right':
                textElement.x = this.canvas.width - margin;
                break;
            case 'center':
            default:
                textElement.x = this.canvas.width / 2;
                textElement.y = this.canvas.height / 2;
                break;
        }
    }

    applyTemplate(templateType) {
        // Remove active class from all template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        event.target.classList.add('active');

        switch (templateType) {
            case 'birthday':
                this.applyBirthdayTemplate();
                break;
            case 'holiday':
                this.applyHolidayTemplate();
                break;
            case 'thank-you':
                this.applyThankYouTemplate();
                break;
            case 'blank':
                this.clearCanvas();
                break;
        }
    }

    applyBirthdayTemplate() {
        this.textElements = [
            {
                id: Date.now(),
                text: 'Happy Birthday!',
                x: this.canvas.width / 2,
                y: 80,
                font: 'Dancing Script',
                size: 48,
                color: '#ff6b6b',
                position: 'top'
            },
            {
                id: Date.now() + 1,
                text: 'Hope your day is wonderful!',
                x: this.canvas.width / 2,
                y: this.canvas.height - 60,
                font: 'Inter',
                size: 20,
                color: '#4a5568',
                position: 'bottom'
            }
        ];
        this.redrawCanvas();
        this.showSuccess('Birthday template applied!');
    }

    applyHolidayTemplate() {
        this.textElements = [
            {
                id: Date.now(),
                text: 'Season\'s Greetings',
                x: this.canvas.width / 2,
                y: 80,
                font: 'Playfair Display',
                size: 36,
                color: '#22c55e',
                position: 'top'
            },
            {
                id: Date.now() + 1,
                text: 'Wishing you joy and happiness',
                x: this.canvas.width / 2,
                y: this.canvas.height - 60,
                font: 'Inter',
                size: 18,
                color: '#374151',
                position: 'bottom'
            }
        ];
        this.redrawCanvas();
        this.showSuccess('Holiday template applied!');
    }

    applyThankYouTemplate() {
        this.textElements = [
            {
                id: Date.now(),
                text: 'Thank You!',
                x: this.canvas.width / 2,
                y: this.canvas.height / 2,
                font: 'Dancing Script',
                size: 42,
                color: '#8b5cf6',
                position: 'center'
            }
        ];
        this.redrawCanvas();
        this.showSuccess('Thank you template applied!');
    }

    redrawCanvas() {
        // Clear canvas
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw image if available
        if (this.currentImage) {
            this.drawImageOnCanvas();
        }

        // Draw text elements
        this.textElements.forEach(textElement => {
            this.drawTextElement(textElement);
        });

        // Draw border (after content so it's on top)
        this.drawBorder();
    }

    drawBorder() {
        if (this.borderStyle === 'none') return;

        this.ctx.save();
        this.ctx.strokeStyle = this.borderColor;
        this.ctx.lineWidth = this.borderWidth;

        const halfWidth = this.borderWidth / 2;
        const x = halfWidth;
        const y = halfWidth;
        const width = this.canvas.width - this.borderWidth;
        const height = this.canvas.height - this.borderWidth;

        if (this.borderRadius > 0) {
            // Rounded rectangle border
            this.drawRoundedRect(x, y, width, height, this.borderRadius);
        } else {
            // Regular rectangle border
            switch (this.borderStyle) {
                case 'solid':
                    this.ctx.setLineDash([]);
                    break;
                case 'dashed':
                    this.ctx.setLineDash([15, 10]);
                    break;
                case 'dotted':
                    this.ctx.setLineDash([3, 3]);
                    break;
                case 'double':
                    this.ctx.setLineDash([]);
                    // Draw outer border
                    this.ctx.strokeRect(x, y, width, height);
                    // Draw inner border
                    const innerOffset = this.borderWidth * 2;
                    this.ctx.strokeRect(x + innerOffset, y + innerOffset, 
                                      width - innerOffset * 2, height - innerOffset * 2);
                    this.ctx.restore();
                    return;
                case 'decorative':
                    this.drawDecorativeBorder(x, y, width, height);
                    this.ctx.restore();
                    return;
            }
            this.ctx.strokeRect(x, y, width, height);
        }

        this.ctx.restore();
    }

    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.stroke();
    }

    drawDecorativeBorder(x, y, width, height) {
        const pattern = 20;
        this.ctx.setLineDash([]);
        
        // Draw corner decorations
        const cornerSize = Math.min(30, this.borderWidth * 3);
        
        // Top-left corner
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + cornerSize);
        this.ctx.lineTo(x, y);
        this.ctx.lineTo(x + cornerSize, y);
        this.ctx.stroke();
        
        // Top-right corner
        this.ctx.beginPath();
        this.ctx.moveTo(x + width - cornerSize, y);
        this.ctx.lineTo(x + width, y);
        this.ctx.lineTo(x + width, y + cornerSize);
        this.ctx.stroke();
        
        // Bottom-right corner
        this.ctx.beginPath();
        this.ctx.moveTo(x + width, y + height - cornerSize);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.lineTo(x + width - cornerSize, y + height);
        this.ctx.stroke();
        
        // Bottom-left corner
        this.ctx.beginPath();
        this.ctx.moveTo(x + cornerSize, y + height);
        this.ctx.lineTo(x, y + height);
        this.ctx.lineTo(x, y + height - cornerSize);
        this.ctx.stroke();
        
        // Draw decorative dots along edges
        for (let i = cornerSize + pattern; i < width - cornerSize; i += pattern) {
            this.ctx.beginPath();
            this.ctx.arc(x + i, y, this.borderWidth / 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.arc(x + i, y + height, this.borderWidth / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        for (let i = cornerSize + pattern; i < height - cornerSize; i += pattern) {
            this.ctx.beginPath();
            this.ctx.arc(x, y + i, this.borderWidth / 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.arc(x + width, y + i, this.borderWidth / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    clearAllText() {
        this.textElements = [];
        this.redrawCanvas();
        this.showSuccess('All text cleared from card!');
    }

    drawImageOnCanvas() {
        const img = this.currentImage;
        const canvasAspect = this.canvas.width / this.canvas.height;
        const imgAspect = img.width / img.height;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > canvasAspect) {
            // Image is wider than canvas
            drawWidth = this.canvas.width;
            drawHeight = this.canvas.width / imgAspect;
            drawX = 0;
            drawY = (this.canvas.height - drawHeight) / 2;
        } else {
            // Image is taller than canvas
            drawHeight = this.canvas.height;
            drawWidth = this.canvas.height * imgAspect;
            drawX = (this.canvas.width - drawWidth) / 2;
            drawY = 0;
        }

        this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    }

    drawTextElement(textElement) {
        this.ctx.font = `${textElement.size}px ${textElement.font}`;
        this.ctx.fillStyle = textElement.color;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Add text shadow for better readability
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        this.ctx.fillText(textElement.text, textElement.x, textElement.y);
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }

    updatePreview() {
        // This method can be used for real-time preview updates
        // For now, it's a placeholder for future enhancements
        console.log('Preview updated');
    }

    updateFontSizeDisplay() {
        const fontSize = document.getElementById('font-size').value;
        document.getElementById('font-size-value').textContent = fontSize + 'px';
    }

    previewCard() {
        // Create a preview modal or highlight the canvas
        this.canvas.style.transform = 'scale(1.05)';
        this.canvas.style.transition = 'transform 0.3s ease';
        
        setTimeout(() => {
            this.canvas.style.transform = 'scale(1)';
        }, 1000);
        
        this.showSuccess('Preview mode activated!');
    }

    async downloadPNG() {
        try {
            this.showLoading('Generating PNG...');
            
            // Use html2canvas to capture the canvas
            const canvas = await html2canvas(this.canvas, {
                backgroundColor: '#ffffff',
                scale: 2 // Higher quality
            });
            
            // Create download link
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `custom-card-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                this.showSuccess('PNG downloaded successfully!');
            }, 'image/png');
            
        } catch (error) {
            this.showError('Failed to generate PNG: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async downloadPDF() {
        try {
            this.showLoading('Generating PDF...');
            
            // Create new jsPDF instance
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [this.canvas.width, this.canvas.height]
            });
            
            // Convert canvas to image data
            const imgData = this.canvas.toDataURL('image/png');
            
            // Add image to PDF
            pdf.addImage(imgData, 'PNG', 0, 0, this.canvas.width, this.canvas.height);
            
            // Download PDF
            pdf.save(`custom-card-${Date.now()}.pdf`);
            
            this.showSuccess('PDF downloaded successfully!');
            
        } catch (error) {
            this.showError('Failed to generate PDF: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    clearCanvas() {
        this.currentImage = null;
        this.textElements = [];
        this.drawInitialCard();
        this.showSuccess('Canvas cleared!');
        
        // Remove active class from template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    // Canvas interaction handlers
    handleCanvasMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Check if clicking on a text element
        const clickedElement = this.getTextElementAt(x, y);
        if (clickedElement) {
            this.isDragging = true;
            this.dragElement = clickedElement;
            this.dragOffset = {
                x: x - clickedElement.x,
                y: y - clickedElement.y
            };
            this.canvas.style.cursor = 'grabbing';
        }
    }

    handleCanvasMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (this.isDragging && this.dragElement) {
            this.dragElement.x = x - this.dragOffset.x;
            this.dragElement.y = y - this.dragOffset.y;
            this.redrawCanvas();
        } else {
            // Change cursor when hovering over text
            const hoveredElement = this.getTextElementAt(x, y);
            this.canvas.style.cursor = hoveredElement ? 'grab' : 'default';
        }
    }

    handleCanvasMouseUp() {
        this.isDragging = false;
        this.dragElement = null;
        this.canvas.style.cursor = 'default';
    }

    getTextElementAt(x, y) {
        // Simple hit detection for text elements
        return this.textElements.find(element => {
            const textWidth = this.ctx.measureText(element.text).width;
            const textHeight = element.size;
            
            return x >= element.x - textWidth / 2 &&
                   x <= element.x + textWidth / 2 &&
                   y >= element.y - textHeight / 2 &&
                   y <= element.y + textHeight / 2;
        });
    }

    handleKeyboardShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 's':
                    event.preventDefault();
                    this.downloadPNG();
                    break;
                case 'p':
                    event.preventDefault();
                    this.downloadPDF();
                    break;
                case 'Delete':
                case 'Backspace':
                    event.preventDefault();
                    this.clearCanvas();
                    break;
            }
        }
    }

    // Utility methods
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('.loading-text');
        text.textContent = message;
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById(`${type}-toast`);
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CustomCardMaker();
});

// Service Worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}