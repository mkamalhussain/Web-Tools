// Image OCR Extractor - Client-side OCR using Tesseract.js

// Elements
const dropArea = document.getElementById('dropArea');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const errorMessage = document.getElementById('errorMessage');
const previewCanvas = document.getElementById('previewCanvas');
const languageSelect = document.getElementById('languageSelect');
const engineSelect = document.getElementById('engineSelect');
const apiKeyInput = document.getElementById('apiKey');
const apiKeyRow = document.getElementById('apiKeyRow');
const extractBtn = document.getElementById('extractBtn');
const progressEl = document.getElementById('progress');
const outputText = document.getElementById('outputText');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');

// State
let currentFile = null;
let objectUrl = null;
let ocrWorker = null;
let workerLang = null;

// Helpers
function setError(msg) { errorMessage.textContent = msg || ''; }
function setProgress(msg) { progressEl.textContent = msg || ''; }

function clearUI() {
  setError('');
  setProgress('');
  outputText.value = '';
  currentFile = null;
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  const ctx = previewCanvas.getContext('2d');
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCanvas.width = 0; previewCanvas.height = 0;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/bmp']);
function isValidFile(file) {
  if (!file) return false;
  if (file.size > 10 * 1024 * 1024) { setError('File too large. Max 10MB.'); return false; }
  if (!file.type || !file.type.startsWith('image/')) { setError('Please upload an image file.'); return false; }
  const type = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  if (!ALLOWED_TYPES.has(type)) { setError('Unsupported format. Use PNG, JPG/JPEG, BMP, or GIF.'); return false; }
  return true;
}

async function drawPreview(file) {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.src = objectUrl;
  await img.decode();
  const maxW = 600;
  const ratio = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  previewCanvas.width = w; previewCanvas.height = h;
  const ctx = previewCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
}

async function handleFile(file) {
  if (!isValidFile(file)) { clearUI(); return; }
  setError('');
  currentFile = file;
  await drawPreview(file);
}

// Drag and drop
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
  dropArea.addEventListener(evt, preventDefaults);
});
dropArea.addEventListener('dragover', () => { dropArea.classList.add('dragover'); });
dropArea.addEventListener('dragleave', () => { dropArea.classList.remove('dragover'); });
dropArea.addEventListener('drop', (e) => {
  dropArea.classList.remove('dragover');
  const dt = e.dataTransfer; const files = dt?.files;
  if (files && files[0]) handleFile(files[0]);
});
// Ensure clicking the upload button doesn't bubble to dropArea and re-open dialog
dropArea.addEventListener('click', (e) => {
  // If the click originated from the upload button, let its handler manage
  const fromUploadBtn = e.target && (e.target.id === 'uploadBtn' || e.target.closest && e.target.closest('#uploadBtn'));
  if (fromUploadBtn) return;
  fileInput.click();
});
uploadBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

// File input
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) handleFile(file);
});

// OCR
async function runOCR() {
  if (!currentFile || previewCanvas.width === 0) { setError('Please upload an image first.'); return; }
  setError('');
  setProgress('Initializing...');
  const lang = languageSelect.value || 'eng';
  // Ensure worker is ready and language initialized
  async function ensureWorker(language) {
    if (!ocrWorker) {
      // Create worker without logger to avoid DataCloneError in some builds
      if (typeof Tesseract.createWorker !== 'function') {
        // Signal unsupported worker path
        throw new Error('worker_not_supported');
      }
      ocrWorker = await Tesseract.createWorker();
      if (typeof ocrWorker.load === 'function') {
        await ocrWorker.load();
      } else {
        throw new Error('worker_methods_missing');
      }
    }
    if (workerLang !== language) {
      setProgress('Initializing language...');
      // Some CDN builds don’t expose loadLanguage; initialize still works
      if (typeof ocrWorker.loadLanguage === 'function') {
        await ocrWorker.loadLanguage(language);
      }
      if (typeof ocrWorker.initialize === 'function') {
        await ocrWorker.initialize(language);
      } else {
        throw new Error('worker_initialize_missing');
      }
      // Prefer auto page segmentation; set a DPI to help accuracy, if supported
      if (typeof ocrWorker.setParameters === 'function') {
        await ocrWorker.setParameters({
          // Use block segmentation for mixed layouts
          tessedit_pageseg_mode: '4',
          user_defined_dpi: '300',
          preserve_interword_spaces: '1'
        });
      }
      workerLang = language;
    }
  }

  // Preprocess image: upscale to max 1200px width, grayscale + contrast boost
  async function getProcessedCanvas() {
    try {
      if (!objectUrl) return previewCanvas;
      const img = new Image();
      img.src = objectUrl;
      await img.decode();
      const targetMaxW = 1200;
      // Allow upscaling up to 2x for small images, downscale large ones to targetMaxW
      const scale = Math.min(2, targetMaxW / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      // Use smoothing when downscaling; disable when upscaling to retain edges
      ctx.imageSmoothingEnabled = scale < 1;
      ctx.imageSmoothingQuality = scale < 1 ? 'high' : 'low';
      ctx.drawImage(img, 0, 0, w, h);

      // Grayscale
      let imgData = ctx.getImageData(0, 0, w, h);
      let d = imgData.data;
      let sumY = 0;
      for (let i = 0; i < d.length; i += 4) {
        const y = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        d[i] = d[i+1] = d[i+2] = y;
        sumY += y;
      }
      ctx.putImageData(imgData, 0, 0);

      // Mild unsharp mask to enhance edges
      const blur = ctx.getImageData(0, 0, w, h);
      const bd = blur.data;
      // Simple box blur 3x3
      const kernel = [
        1,1,1,
        1,1,1,
        1,1,1
      ];
      const kw = 3, kh = 3, ksum = 9;
      const src = new Uint8ClampedArray(d);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let acc = 0;
          let ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const sx = x + kx;
              const sy = y + ky;
              const si = (sy * w + sx) * 4;
              acc += src[si] * kernel[ki++];
            }
          }
          const bi = (y * w + x) * 4;
          const by = acc / ksum;
          // Unsharp: original + amount*(original - blur)
          const oy = src[bi];
          const ny = Math.max(0, Math.min(255, oy + 0.5 * (oy - by)));
          bd[bi] = bd[bi+1] = bd[bi+2] = ny;
          bd[bi+3] = 255;
        }
      }
      ctx.putImageData(blur, 0, 0);

      // Otsu thresholding
      imgData = ctx.getImageData(0, 0, w, h);
      d = imgData.data;
      const hist = new Array(256).fill(0);
      for (let i = 0; i < d.length; i += 4) { hist[d[i]|0]++; }
      let total = w * h;
      let sum = 0;
      for (let t = 0; t < 256; t++) sum += t * hist[t];
      let sumB = 0, wB = 0, wF = 0, varMax = 0, threshold = 128;
      for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const betweenVar = wB * wF * (mB - mF) * (mB - mF);
        if (betweenVar > varMax) { varMax = betweenVar; threshold = t; }
      }
      // Apply threshold
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] > threshold ? 255 : 0;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = 255;
      }
      // Smart invert for dark backgrounds: prefer white background, black text
      const avgY = sumY / (w * h);
      if (avgY < 128) {
        for (let i = 0; i < d.length; i += 4) {
          d[i] = 255 - d[i];
          d[i+1] = 255 - d[i+1];
          d[i+2] = 255 - d[i+2];
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return c;
    } catch {
      // Fallback to previewCanvas if processing fails
      return previewCanvas;
    }
  }
  try {
    const processedCanvas = await getProcessedCanvas();
    // Pass a data URL to avoid cloning DOM elements into the worker
    const dataUrl = processedCanvas.toDataURL('image/png');
    let result;
    const engine = (engineSelect?.value || 'local');
    if (engine === 'cloud') {
      const cloud = await runCloudOCR(dataUrl, lang);
      const text = cloud.text || '';
      if (!text.trim()) { setError('No text detected.'); }
      outputText.value = text;
      setProgress('');
      return;
    }
    try {
      await ensureWorker(lang);
      if (!ocrWorker || typeof ocrWorker.recognize !== 'function') {
        throw new Error('worker_recognize_missing');
      }
      result = await ocrWorker.recognize(dataUrl);
    } catch (workerErr) {
      // Fallback to global recognize when worker path is unsupported
      console.warn('Worker path unavailable, falling back to Tesseract.recognize:', workerErr.message || workerErr);
      result = await Tesseract.recognize(dataUrl, lang, {
        tessedit_pageseg_mode: '4',
        user_defined_dpi: '300',
        preserve_interword_spaces: '1',
        logger: m => {
          if (m.status && typeof m.progress === 'number') {
            const pct = Math.round(m.progress * 100);
            setProgress(`${m.status} ${pct}%`);
          } else if (m.status) {
            setProgress(m.status);
          }
        }
      });
    }
    const text = (result && result.data && result.data.text) ? result.data.text : '';
    if (!text.trim()) {
      setError('No text detected.');
    }
    outputText.value = text;
    setProgress('');
  } catch (err) {
    console.error(err);
    setError('Error processing image.');
    setProgress('');
  }
}
extractBtn.addEventListener('click', runOCR);

// Copy
async function copyText() {
  const text = outputText.value || '';
  if (!text.trim()) { setError('No text to copy.'); return; }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setError('');
    setProgress('Copied to clipboard.');
    setTimeout(() => setProgress(''), 1500);
  } catch (e) {
    setError('Copy failed.');
  }
}
copyBtn.addEventListener('click', copyText);

// Download
function downloadTxt() {
  const text = outputText.value || '';
  if (!text.trim()) { setError('No text to download.'); return; }
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'extracted-text.txt';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
downloadBtn.addEventListener('click', downloadTxt);

// Clear
clearBtn.addEventListener('click', async () => {
  clearUI();
  fileInput.value = '';
  // Optional: terminate worker to free memory; will be recreated next run
  try {
    if (ocrWorker) { await ocrWorker.terminate(); }
  } catch {}
  ocrWorker = null; workerLang = null;
});

// Init
clearUI();
// Engine selector UI
engineSelect?.addEventListener('change', () => {
  const useCloud = engineSelect.value === 'cloud';
  apiKeyRow.style.display = useCloud ? 'block' : 'none';
});

async function runCloudOCR(dataUrl, lang) {
  setProgress('Uploading to cloud OCR...');
  const apiKey = (apiKeyInput?.value || '').trim();
  if (!apiKey) { setError('API key required for Cloud OCR.'); return { text: '' }; }
  try {
    // OCR.space API: https://ocr.space/OCRAPI
    const form = new FormData();
    form.append('base64Image', dataUrl);
    form.append('language', lang);
    form.append('isOverlayRequired', 'false');
    form.append('OCREngine', '2'); // Engine 2 is recommended

    const resp = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'apikey': apiKey },
      body: form,
    });
    if (!resp.ok) throw new Error('Cloud OCR request failed');
    const json = await resp.json();
    if (json?.IsErroredOnProcessing) throw new Error(json?.ErrorMessage || 'Cloud OCR error');
    const parsed = json?.ParsedResults?.[0]?.ParsedText || '';
    return { text: parsed };
  } catch (e) {
    console.error(e);
    setError('Cloud OCR failed.');
    return { text: '' };
  } finally {
    setProgress('');
  }
}