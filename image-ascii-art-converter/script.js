const fileInput = document.getElementById('fileInput');
const charsetPreset = document.getElementById('charsetPreset');
const charsetCustom = document.getElementById('charsetCustom');
const widthSlider = document.getElementById('widthSlider');
const widthValue = document.getElementById('widthValue');
const convertBtn = document.getElementById('convertBtn');
const resetBtn = document.getElementById('resetBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const previewImg = document.getElementById('previewImg');
const asciiOutput = document.getElementById('asciiOutput');
const imgMeta = document.getElementById('imgMeta');
const asciiMeta = document.getElementById('asciiMeta');
const autoApply = document.getElementById('autoApply');
const invert = document.getElementById('invert');
const outputTheme = document.getElementById('outputTheme');
const gammaSlider = document.getElementById('gammaSlider');
const gammaValue = document.getElementById('gammaValue');
const aspectSlider = document.getElementById('aspectSlider');
const aspectValue = document.getElementById('aspectValue');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const fontSizeValue = document.getElementById('fontSizeValue');
const brightnessSlider = document.getElementById('brightnessSlider');
const brightnessValue = document.getElementById('brightnessValue');
const contrastSlider = document.getElementById('contrastSlider');
const contrastValue = document.getElementById('contrastValue');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const weightedSampling = document.getElementById('weightedSampling');
const sharpenSlider = document.getElementById('sharpenSlider');
const sharpenValue = document.getElementById('sharpenValue');
const exportHtmlBtn = document.getElementById('exportHtmlBtn');
const adaptiveColumns = document.getElementById('adaptiveColumns');
const thresholdMode = document.getElementById('thresholdMode');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue = document.getElementById('thresholdValue');
const oversampleSlider = document.getElementById('oversampleSlider');
const oversampleValue = document.getElementById('oversampleValue');

const presets = {
  standard: "@%#*+=-:. ",
  dense: "@#MW&8%B$ZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,\"^`' .",
  sparse: "@#*+=-:. ",
  blocks: "█▓▒░ .",
};

let currentImage = null;
let asciiText = '';

function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    currentImage = img;
    previewImg.src = url;
    imgMeta.textContent = `${img.width} × ${img.height}`;
    convertBtn.disabled = false;
    if (autoApply && autoApply.checked) {
      doConvert();
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function getCharset() {
  if (charsetPreset.value === 'custom') {
    const text = charsetCustom.value || '';
    return text.length ? text : presets.standard;
  }
  return presets[charsetPreset.value] || presets.standard;
}

function toGrayscale(r, g, b) {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function convertToASCII(img, columns, charset, gamma = 1, aspect = 2, invertFlag = false, brightness = 0, contrast = 1, weightedFlag = false, sharpenAmt = 0, thresholdFlag = false, threshold = 0.5, oversample = 1) {
  const charArray = Array.from(charset);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Character aspect ratio (height:width)

  const scale = columns / img.width;
  const targetW = Math.max(1, Math.floor(columns));
  const targetH = Math.max(1, Math.floor(img.height * scale / aspect));

  const overs = Math.max(1, Math.floor(oversample));
  canvas.width = targetW * overs;
  canvas.height = targetH * overs;
  // Control image smoothing quality when downscaling
  ctx.imageSmoothingEnabled = !!weightedFlag;
  if (weightedFlag && ctx.imageSmoothingQuality) {
    ctx.imageSmoothingQuality = 'high';
  }
  ctx.drawImage(img, 0, 0, targetW * overs, targetH * overs);

  const total = targetW * targetH;
  const bright = new Float32Array(total);

  // Stage 1: compute normalized brightness with brightness/contrast and invert
  if (overs > 1) {
    const dataHi = ctx.getImageData(0, 0, targetW * overs, targetH * overs).data;
    const rowStride = (targetW * overs) * 4;
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        let sum = 0;
        for (let oy = 0; oy < overs; oy++) {
          const baseY = (y * overs + oy) * rowStride;
          for (let ox = 0; ox < overs; ox++) {
            const i4 = baseY + (x * overs + ox) * 4;
            const gray = toGrayscale(dataHi[i4], dataHi[i4+1], dataHi[i4+2]);
            let b = gray / 255;
            b = (b - 0.5) * contrast + 0.5 + brightness;
            b = Math.min(1, Math.max(0, b));
            if (invertFlag) b = 1 - b;
            sum += b;
          }
        }
        bright[y * targetW + x] = sum / (overs * overs);
      }
    }
  } else {
    const data = ctx.getImageData(0, 0, targetW, targetH).data;
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const i4 = (y * targetW + x) * 4;
        const gray = toGrayscale(data[i4], data[i4+1], data[i4+2]);
        let b = gray / 255;
        b = (b - 0.5) * contrast + 0.5 + brightness;
        b = Math.min(1, Math.max(0, b));
        if (invertFlag) b = 1 - b;
        bright[y * targetW + x] = b;
      }
    }
  }

  // Stage 2: optional unsharp mask sharpen
  if (sharpenAmt > 0.0001) {
    const out = new Float32Array(total);
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        let sum = 0;
        let count = 0;
        // 3x3 box blur
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= targetH) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= targetW) continue;
            sum += bright[yy * targetW + xx];
            count++;
          }
        }
        const blurred = sum / count;
        const base = bright[y * targetW + x];
        const usm = base + sharpenAmt * (base - blurred);
        out[y * targetW + x] = Math.min(1, Math.max(0, usm));
      }
    }
    // replace
    for (let i = 0; i < total; i++) bright[i] = out[i];
  }

  // Stage 3: gamma and mapping to characters (threshold-aware)
  const levels = charArray.length - 1;
  let result = '';
  for (let y = 0; y < targetH; y++) {
    let row = '';
    for (let x = 0; x < targetW; x++) {
      let b = bright[y * targetW + x];
      b = Math.pow(b, gamma);
      if (thresholdFlag) {
        row += b >= threshold ? charArray[levels] : charArray[0];
      } else {
        const idx = Math.min(levels, Math.max(0, Math.round(b * levels)));
        row += charArray[idx];
      }
    }
    result += row + '\n';
  }
  return result;
}

function updateWidthLabel() {
  if (adaptiveColumns && adaptiveColumns.checked && currentImage) {
    const size = parseInt(fontSizeSlider?.value || '12', 10);
    const approxCharPx = size * 0.6; // monospace average width estimate
    const autoCols = Math.min(200, Math.max(40, Math.round(currentImage.width / approxCharPx)));
    widthValue.textContent = `${autoCols} (auto)`;
    asciiMeta.textContent = `Width: ${autoCols} cols`;
  } else {
    widthValue.textContent = widthSlider.value;
    asciiMeta.textContent = `Width: ${widthSlider.value} cols`;
  }
}

function doConvert() {
  if (!currentImage) return;
  let columns = parseInt(widthSlider.value, 10);
  if (adaptiveColumns && adaptiveColumns.checked && currentImage) {
    const size = parseInt(fontSizeSlider?.value || '12', 10);
    const approxCharPx = size * 0.6;
    columns = Math.min(200, Math.max(40, Math.round(currentImage.width / approxCharPx)));
  }
  const charset = getCharset();
  const gamma = parseFloat(gammaSlider?.value || '1');
  const aspect = parseFloat(aspectSlider?.value || '2');
  const invertFlag = !!invert?.checked;
  const brightness = parseFloat(brightnessSlider?.value || '0');
  const contrast = parseFloat(contrastSlider?.value || '1');
  const weightedFlag = !!weightedSampling?.checked;
  const sharpenAmt = parseFloat(sharpenSlider?.value || '0');
  const thresholdFlag = !!thresholdMode?.checked;
  const threshold = parseFloat(thresholdSlider?.value || '0.5');
  const oversample = parseInt(oversampleSlider?.value || '1', 10);
  asciiText = convertToASCII(currentImage, columns, charset, gamma, aspect, invertFlag, brightness, contrast, weightedFlag, sharpenAmt, thresholdFlag, threshold, oversample);
  asciiOutput.textContent = asciiText;
  // Theme class
  const themeClass = outputTheme?.value === 'light' ? 'theme-light' : 'theme-dark';
  asciiOutput.classList.remove('theme-light', 'theme-dark');
  asciiOutput.classList.add(themeClass);
  // Typography
  const size = parseInt(fontSizeSlider?.value || '12', 10);
  asciiOutput.style.fontSize = `${size}px`;
  asciiOutput.style.lineHeight = `${size}px`;
  if (fontSizeValue) fontSizeValue.textContent = `${size}px`;
  copyBtn.disabled = !asciiText;
  downloadBtn.disabled = !asciiText;
  if (exportHtmlBtn) exportHtmlBtn.disabled = !asciiText;
  persistSettings();
}

function resetAll() {
  currentImage = null;
  asciiText = '';
  previewImg.removeAttribute('src');
  asciiOutput.textContent = '';
  imgMeta.textContent = 'No image loaded';
  convertBtn.disabled = true;
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  charsetPreset.value = 'standard';
  charsetCustom.value = '';
  charsetCustom.disabled = true;
  widthSlider.value = '120';
  updateWidthLabel();
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) { loadImage(file); }
});

charsetPreset.addEventListener('change', (e) => {
  const v = e.target.value;
  const custom = v === 'custom';
  charsetCustom.disabled = !custom;
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});

charsetCustom.addEventListener('input', () => {
  if (charsetPreset.value === 'custom') {
    // live apply on input
    if (autoApply.checked && currentImage) doConvert();
  }
  persistSettings();
});

widthSlider.addEventListener('input', () => {
  updateWidthLabel();
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});

convertBtn.addEventListener('click', doConvert);
resetBtn.addEventListener('click', resetAll);

copyBtn.addEventListener('click', async () => {
  if (!asciiText) return;
  try {
    await navigator.clipboard.writeText(asciiText);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy ASCII'), 1200);
  } catch {}
});

downloadBtn.addEventListener('click', () => {
  if (!asciiText) return;
  const blob = new Blob([asciiText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ascii-art.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// New control handlers
gammaSlider.addEventListener('input', () => {
  gammaValue.textContent = parseFloat(gammaSlider.value).toFixed(2);
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
aspectSlider.addEventListener('input', () => {
  aspectValue.textContent = parseFloat(aspectSlider.value).toFixed(2);
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
invert.addEventListener('change', () => {
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
weightedSampling.addEventListener('change', () => {
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
outputTheme.addEventListener('change', () => {
  const themeClass = outputTheme.value === 'light' ? 'theme-light' : 'theme-dark';
  asciiOutput.classList.remove('theme-light', 'theme-dark');
  asciiOutput.classList.add(themeClass);
  persistSettings();
});
fontSizeSlider.addEventListener('input', () => {
  const size = parseInt(fontSizeSlider.value, 10);
  asciiOutput.style.fontSize = `${size}px`;
  asciiOutput.style.lineHeight = `${size}px`;
  fontSizeValue.textContent = `${size}px`;
  persistSettings();
});

brightnessSlider.addEventListener('input', () => {
  brightnessValue.textContent = parseFloat(brightnessSlider.value).toFixed(2);
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
contrastSlider.addEventListener('input', () => {
  contrastValue.textContent = parseFloat(contrastSlider.value).toFixed(2);
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
sharpenSlider.addEventListener('input', () => {
  sharpenValue.textContent = parseFloat(sharpenSlider.value).toFixed(2);
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});

resetSettingsBtn.addEventListener('click', () => {
  // Reset rendering settings to defaults
  autoApply.checked = true;
  invert.checked = false;
  outputTheme.value = 'dark';
  brightnessSlider.value = '0';
  contrastSlider.value = '1';
  gammaSlider.value = '1';
  aspectSlider.value = '2';
  fontSizeSlider.value = '12';
  weightedSampling.checked = false;
  sharpenSlider.value = '0';
  if (adaptiveColumns) adaptiveColumns.checked = false;
  if (thresholdMode) thresholdMode.checked = false;
  if (thresholdSlider) thresholdSlider.value = '0.5';
  if (oversampleSlider) oversampleSlider.value = '1';
  gammaValue.textContent = '1.00';
  aspectValue.textContent = '2.00';
  brightnessValue.textContent = '0.00';
  contrastValue.textContent = '1.00';
  sharpenValue.textContent = '0.00';
  if (thresholdValue) thresholdValue.textContent = '0.50';
  if (oversampleValue) oversampleValue.textContent = '1×';
  const themeClass = 'theme-dark';
  asciiOutput.classList.remove('theme-light', 'theme-dark');
  asciiOutput.classList.add(themeClass);
  asciiOutput.style.fontSize = `12px`;
  asciiOutput.style.lineHeight = `12px`;
  persistSettings();
  if (currentImage) {
    if (autoApply.checked) doConvert();
  }
});

function persistSettings() {
  const settings = {
    autoApply: !!autoApply.checked,
    invert: !!invert.checked,
    outputTheme: outputTheme.value,
    brightness: parseFloat(brightnessSlider.value),
    contrast: parseFloat(contrastSlider.value),
    gamma: parseFloat(gammaSlider.value),
    aspect: parseFloat(aspectSlider.value),
    fontSize: parseInt(fontSizeSlider.value, 10),
    columns: parseInt(widthSlider.value, 10),
    charsetPreset: charsetPreset.value,
    charsetCustom: charsetCustom.value,
    weightedSampling: !!weightedSampling.checked,
    sharpen: parseFloat(sharpenSlider.value),
    adaptiveColumns: !!(adaptiveColumns?.checked),
    thresholdMode: !!(thresholdMode?.checked),
    threshold: parseFloat(thresholdSlider?.value || '0.5'),
    oversample: parseInt(oversampleSlider?.value || '1', 10),
  };
  try { localStorage.setItem('asciiSettings', JSON.stringify(settings)); } catch {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('asciiSettings');
    if (!raw) return;
    const s = JSON.parse(raw);
    autoApply.checked = !!s.autoApply;
    invert.checked = !!s.invert;
    outputTheme.value = s.outputTheme || 'dark';
    brightnessSlider.value = String(s.brightness ?? 0);
    contrastSlider.value = String(s.contrast ?? 1);
    gammaSlider.value = String(s.gamma ?? 1);
    aspectSlider.value = String(s.aspect ?? 2);
    fontSizeSlider.value = String(s.fontSize ?? 12);
    widthSlider.value = String(s.columns ?? 120);
    charsetPreset.value = s.charsetPreset || 'standard';
    charsetCustom.value = s.charsetCustom || '';
    charsetCustom.disabled = charsetPreset.value !== 'custom';
    weightedSampling.checked = !!(s.weightedSampling ?? false);
    sharpenSlider.value = String(s.sharpen ?? 0);
    if (adaptiveColumns) adaptiveColumns.checked = !!(s.adaptiveColumns ?? false);
    if (thresholdMode) thresholdMode.checked = !!(s.thresholdMode ?? false);
    if (thresholdSlider) thresholdSlider.value = String(s.threshold ?? 0.5);
    if (oversampleSlider) oversampleSlider.value = String(s.oversample ?? 1);
  } catch {}
}

// Init
loadSettings();
updateWidthLabel();
gammaValue.textContent = parseFloat(gammaSlider.value).toFixed(2);
aspectValue.textContent = parseFloat(aspectSlider.value).toFixed(2);
brightnessValue.textContent = parseFloat(brightnessSlider.value).toFixed(2);
contrastValue.textContent = parseFloat(contrastSlider.value).toFixed(2);
sharpenValue.textContent = parseFloat(sharpenSlider.value).toFixed(2);
if (thresholdValue && thresholdSlider) thresholdValue.textContent = parseFloat(thresholdSlider.value).toFixed(2);
if (oversampleValue && oversampleSlider) oversampleValue.textContent = `${parseInt(oversampleSlider.value, 10)}×`;
const themeClassInit = outputTheme.value === 'light' ? 'theme-light' : 'theme-dark';
asciiOutput.classList.add(themeClassInit);
asciiOutput.style.fontSize = `${parseInt(fontSizeSlider.value, 10)}px`;
asciiOutput.style.lineHeight = `${parseInt(fontSizeSlider.value, 10)}px`;

// Export HTML handler
exportHtmlBtn.addEventListener('click', () => {
  if (!asciiText) return;
  const size = parseInt(fontSizeSlider.value, 10);
  const theme = outputTheme.value;
  const textEscaped = asciiText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bg = theme === 'light' ? '#ffffff' : '#0b0f16';
  const fg = theme === 'light' ? '#1f2737' : '#dfe6ff';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ASCII Art Export</title><style>body{margin:16px;background:${bg};}pre{white-space:pre;font-family:Consolas,Menlo,monospace;font-size:${size}px;line-height:${size}px;color:${fg};}</style></head><body><pre>${textEscaped}</pre></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ascii-art.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// New controls: adaptive columns and threshold/oversample
adaptiveColumns?.addEventListener('change', () => {
  updateWidthLabel();
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
thresholdMode?.addEventListener('change', () => {
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
thresholdSlider?.addEventListener('input', () => {
  thresholdValue.textContent = parseFloat(thresholdSlider.value).toFixed(2);
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});
oversampleSlider?.addEventListener('input', () => {
  oversampleValue.textContent = `${parseInt(oversampleSlider.value, 10)}×`;
  if (autoApply.checked && currentImage) doConvert();
  persistSettings();
});

// Adaptive columns: respond to window resize (font size changes density)
window.addEventListener('resize', () => {
  if (!currentImage) return;
  if (adaptiveColumns && adaptiveColumns.checked) {
    updateWidthLabel();
    if (autoApply.checked) doConvert();
  }
});