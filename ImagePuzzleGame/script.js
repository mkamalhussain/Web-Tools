// Image Puzzle Game - Complete Implementation
class ImagePuzzleGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.image = null;
        this.gridSize = 3;
        this.tileSize = 0;
        this.tiles = [];
        this.emptyTile = { x: 0, y: 0 };
        this.gameStarted = false;
        this.gameWon = false;
        this.startTime = null;
        this.timerInterval = null;
        this.moveCount = 0;
        this.originalImageData = null;
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.setupKeyboardControls();
    }

    setupElements() {
        // Get DOM elements
        this.imageUpload = document.getElementById('imageUpload');
        this.imagePreview = document.getElementById('imagePreview');
        this.previewContainer = document.getElementById('previewContainer');
        this.puzzleContainer = document.getElementById('puzzleContainer');
        this.canvas = document.getElementById('puzzleCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSizeSelect = document.getElementById('gridSize');
        this.startBtn = document.getElementById('startBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.hintBtn = document.getElementById('hintBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.timer = document.getElementById('timer');
        this.moveCounter = document.getElementById('moveCounter');
        this.winModal = document.getElementById('winModal');
        this.playAgainBtn = document.getElementById('playAgainBtn');
        this.finalTime = document.getElementById('finalTime');
        this.finalMoves = document.getElementById('finalMoves');
    }

    setupEventListeners() {
        // Image upload
        this.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
        
        // Game controls
        this.startBtn.addEventListener('click', () => this.startGame());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.hintBtn.addEventListener('click', () => this.showHint());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.playAgainBtn.addEventListener('click', () => this.playAgain());
        
        // Grid size change
        this.gridSizeSelect.addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
            if (this.image && this.gameStarted) {
                this.resetGame();
            }
        });

        // Canvas click
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        
        // Modal close
        this.winModal.addEventListener('click', (e) => {
            if (e.target === this.winModal) {
                this.closeWinModal();
            }
        });
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameStarted || this.gameWon) return;

            switch(e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.moveTile(this.emptyTile.x, this.emptyTile.y + 1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.moveTile(this.emptyTile.x, this.emptyTile.y - 1);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.moveTile(this.emptyTile.x + 1, this.emptyTile.y);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.moveTile(this.emptyTile.x - 1, this.emptyTile.y);
                    break;
                case ' ':
                    e.preventDefault();
                    this.showHint();
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.resetGame();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (!this.gameStarted && this.image) {
                        this.startGame();
                    }
                    break;
            }
        });
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.loadImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    loadImage(src) {
        this.image = new Image();
        this.image.onload = () => {
            this.displayPreview();
            this.startBtn.disabled = false;
            this.previewContainer.classList.remove('hidden');
            this.previewContainer.classList.add('animate-slide-in');
        };
        this.image.src = src;
    }

    displayPreview() {
        this.imagePreview.src = this.image.src;
        this.imagePreview.alt = 'Puzzle image preview';
    }

    startGame() {
        if (!this.image) return;

        this.gameStarted = true;
        this.gameWon = false;
        this.moveCount = 0;
        this.updateMoveCounter();
        
        this.setupCanvas();
        this.generateTiles();
        this.shuffleTiles();
        this.drawPuzzle();
        this.startTimer();
        
        this.puzzleContainer.classList.remove('hidden');
        this.puzzleContainer.classList.add('animate-slide-in');
        
        // Enable game controls
        this.resetBtn.disabled = false;
        this.hintBtn.disabled = false;
        this.downloadBtn.disabled = false;
        this.startBtn.textContent = '🎮 Restart Game';
    }

    setupCanvas() {
        const maxSize = Math.min(window.innerWidth * 0.6, 500);
        const aspectRatio = this.image.width / this.image.height;
        
        if (aspectRatio > 1) {
            this.canvas.width = maxSize;
            this.canvas.height = maxSize / aspectRatio;
        } else {
            this.canvas.height = maxSize;
            this.canvas.width = maxSize * aspectRatio;
        }
        
        this.tileSize = this.canvas.width / this.gridSize;
        
        // Store original image data for hint
        this.originalImageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
        this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    generateTiles() {
        this.tiles = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (x === this.gridSize - 1 && y === this.gridSize - 1) {
                    // Empty tile
                    this.tiles.push(null);
                    this.emptyTile = { x, y };
                } else {
                    this.tiles.push({
                        id: y * this.gridSize + x,
                        currentX: x,
                        currentY: y,
                        correctX: x,
                        correctY: y
                    });
                }
            }
        }
    }

    shuffleTiles() {
        // Perform random valid moves to ensure solvable puzzle
        const moves = this.gridSize * this.gridSize * 10;
        for (let i = 0; i < moves; i++) {
            const possibleMoves = this.getPossibleMoves();
            if (possibleMoves.length > 0) {
                const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                this.moveTileInternal(randomMove.x, randomMove.y, false);
            }
        }
    }

    getPossibleMoves() {
        const moves = [];
        const { x, y } = this.emptyTile;
        
        // Check all four directions
        if (x > 0) moves.push({ x: x - 1, y });
        if (x < this.gridSize - 1) moves.push({ x: x + 1, y });
        if (y > 0) moves.push({ x, y: y - 1 });
        if (y < this.gridSize - 1) moves.push({ x, y: y + 1 });
        
        return moves;
    }

    moveTile(x, y) {
        if (!this.gameStarted || this.gameWon) return false;
        
        return this.moveTileInternal(x, y, true);
    }

    moveTileInternal(x, y, countMove = true) {
        // Check if the tile is adjacent to empty space
        if (Math.abs(x - this.emptyTile.x) + Math.abs(y - this.emptyTile.y) !== 1) {
            return false;
        }
        
        // Check bounds
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) {
            return false;
        }
        
        // Swap tile with empty space
        const tileIndex = y * this.gridSize + x;
        const emptyIndex = this.emptyTile.y * this.gridSize + this.emptyTile.x;
        
        const tile = this.tiles[tileIndex];
        if (tile) {
            tile.currentX = this.emptyTile.x;
            tile.currentY = this.emptyTile.y;
        }
        
        this.tiles[emptyIndex] = tile;
        this.tiles[tileIndex] = null;
        
        this.emptyTile = { x, y };
        
        if (countMove) {
            this.moveCount++;
            this.updateMoveCounter();
            this.drawPuzzle();
            
            if (this.checkWin()) {
                this.winGame();
            }
        }
        
        return true;
    }

    handleCanvasClick(event) {
        if (!this.gameStarted || this.gameWon) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / this.tileSize);
        const y = Math.floor((event.clientY - rect.top) / this.tileSize);
        
        this.moveTile(x, y);
    }

    drawPuzzle() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            if (!tile) continue; // Skip empty tile
            
            const currentX = tile.currentX * this.tileSize;
            const currentY = tile.currentY * this.tileSize;
            const sourceX = tile.correctX * this.tileSize;
            const sourceY = tile.correctY * this.tileSize;
            
            // Draw tile image
            this.ctx.drawImage(
                this.image,
                sourceX * (this.image.width / this.canvas.width),
                sourceY * (this.image.height / this.canvas.height),
                this.tileSize * (this.image.width / this.canvas.width),
                this.tileSize * (this.image.height / this.canvas.height),
                currentX,
                currentY,
                this.tileSize,
                this.tileSize
            );
            
            // Draw tile border
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(currentX, currentY, this.tileSize, this.tileSize);
        }
        
        // Draw empty tile
        const emptyX = this.emptyTile.x * this.tileSize;
        const emptyY = this.emptyTile.y * this.tileSize;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(emptyX, emptyY, this.tileSize, this.tileSize);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(emptyX, emptyY, this.tileSize, this.tileSize);
        this.ctx.setLineDash([]);
    }

    checkWin() {
        for (let i = 0; i < this.tiles.length - 1; i++) {
            const tile = this.tiles[i];
            if (!tile || tile.currentX !== tile.correctX || tile.currentY !== tile.correctY) {
                return false;
            }
        }
        return true;
    }

    winGame() {
        this.gameWon = true;
        this.stopTimer();
        
        // Draw complete image
        this.ctx.putImageData(this.originalImageData, 0, 0);
        
        // Show win modal
        this.finalTime.textContent = this.timer.textContent;
        this.finalMoves.textContent = this.moveCount.toString();
        this.winModal.classList.remove('hidden');
        this.winModal.classList.add('flex');
        
        // Add celebration animation
        this.canvas.classList.add('animate-celebrate');
        setTimeout(() => {
            this.canvas.classList.remove('animate-celebrate');
        }, 600);
        
        this.createConfetti();
    }

    createConfetti() {
        const colors = ['#f39c12', '#e74c3c', '#9b59b6', '#3498db', '#2ecc71'];
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'confetti';
        document.body.appendChild(confettiContainer);
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confettiContainer.appendChild(confetti);
        }
        
        setTimeout(() => {
            document.body.removeChild(confettiContainer);
        }, 5000);
    }

    resetGame() {
        if (!this.image) return;
        
        this.gameWon = false;
        this.moveCount = 0;
        this.updateMoveCounter();
        this.stopTimer();
        this.resetTimer();
        
        this.generateTiles();
        this.shuffleTiles();
        this.drawPuzzle();
        this.startTimer();
    }

    showHint() {
        if (!this.gameStarted || this.gameWon) return;
        
        // Create hint overlay
        const overlay = document.createElement('div');
        overlay.className = 'hint-overlay';
        
        const hintImage = document.createElement('img');
        hintImage.className = 'hint-image';
        hintImage.src = this.image.src;
        hintImage.alt = 'Puzzle solution hint';
        
        overlay.appendChild(hintImage);
        this.puzzleContainer.appendChild(overlay);
        
        // Remove hint after 2 seconds
        setTimeout(() => {
            this.puzzleContainer.removeChild(overlay);
        }, 2000);
    }

    downloadImage() {
        if (!this.image) return;
        
        // Create a temporary canvas with the complete image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.image.width;
        tempCanvas.height = this.image.height;
        tempCtx.drawImage(this.image, 0, 0);
        
        // Download the image
        const link = document.createElement('a');
        link.download = 'puzzle-solved.png';
        link.href = tempCanvas.toDataURL();
        link.click();
    }

    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.timer.textContent = '00:00';
    }

    updateTimer() {
        if (!this.startTime) return;
        
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        this.timer.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateMoveCounter() {
        this.moveCounter.textContent = this.moveCount.toString();
    }

    closeWinModal() {
        this.winModal.classList.add('hidden');
        this.winModal.classList.remove('flex');
    }

    playAgain() {
        this.closeWinModal();
        this.resetGame();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ImagePuzzleGame();
});

// Service Worker registration for PWA capabilities (optional)
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