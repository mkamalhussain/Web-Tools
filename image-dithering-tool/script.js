const fileInput = document.getElementById('fileInput');
const algorithmSelect = document.getElementById('algorithm');
const colorsSelect = document.getElementById('colors');
const paletteSelect = document.getElementById('palette');
const autoApply = document.getElementById('autoApply');
const applyBtn = document.getElementById('applyBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const themeSelect = document.getElementById('theme');
const densitySelect = document.getElementById('density');
const canvasMeta = document.getElementById('canvasMeta');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let originalImage = null;

function enableControls(enabled) {
  applyBtn.disabled = !enabled;
  resetBtn.disabled = !enabled;
  downloadBtn.disabled = !enabled;
}

function imageToCanvas(image) {
  const maxW = Math.min(window.innerWidth - 64, image.width);
  const scale = maxW / image.width;
  const w = Math.floor(image.width * scale);
  const h = Math.floor(image.height * scale);
  canvas.width = w; canvas.height = h;
  ctx.drawImage(image, 0, 0, w, h);
  if (canvasMeta) canvasMeta.textContent = `${w}×${h}px`;
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      imageToCanvas(img);
      enableControls(true);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function buildGrayscalePalette(n) {
  // n levels from 0..255
  const pal = [];
  for (let i = 0; i < n; i++) {
    const v = Math.round((i / (n - 1)) * 255);
    pal.push([v, v, v]);
  }
  return pal;
}

function buildRetro4Palette() {
  // A pleasing retro 4-color set (dark, blue, red, yellow)
  return [
    [0, 0, 0],
    [110, 125, 255],
    [255, 107, 107],
    [255, 217, 61]
  ];
}

function buildCga16Palette() {
  // Standard-ish CGA/EGA-like 16 color palette
  return [
    [0, 0, 0],           // black
    [0, 0, 170],         // blue
    [0, 170, 0],         // green
    [0, 170, 170],       // cyan
    [170, 0, 0],         // red
    [170, 0, 170],       // magenta
    [170, 85, 0],        // brown
    [170, 170, 170],     // light gray
    [85, 85, 85],        // dark gray
    [85, 85, 255],       // light blue
    [85, 255, 85],       // light green
    [85, 255, 255],      // light cyan
    [255, 85, 85],       // light red
    [255, 85, 255],      // light magenta
    [255, 255, 85],      // yellow
    [255, 255, 255]      // white
  ];
}

function nearestPaletteIndexRGB(r, g, b, palette) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const pr = palette[i][0], pg = palette[i][1], pb = palette[i][2];
    const dr = r - pr, dg = g - pg, db = b - pb;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function nearestPaletteIndex(gray, palette) {
  // palette is grayscale, so compare against palette[i][0]
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = Math.abs(gray - palette[i][0]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function toGrayscale(r, g, b) {
  // Perceived luminance
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function applyThresholdDither(imgData, palette) {
  const { data, width, height } = imgData;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = toGrayscale(data[i], data[i + 1], data[i + 2]);
      const idx = nearestPaletteIndex(gray, palette);
      const [r, g, b] = palette[idx];
      data[i] = r; data[i + 1] = g; data[i + 2] = b; // a preserved
    }
  }
}

function applyFloydSteinberg(imgData, palette) {
  const { data, width, height } = imgData;
  const buffer = new Float32Array(width * height); // grayscale working buffer
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      buffer[y * width + x] = toGrayscale(data[i], data[i + 1], data[i + 2]);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idxBuf = y * width + x;
      const old = buffer[idxBuf];
      const pIdx = nearestPaletteIndex(old, palette);
      const newVal = palette[pIdx][0];
      const err = old - newVal;
      buffer[idxBuf] = newVal;
      // Diffuse error
      // (x+1, y)   += err * 7/16
      // (x-1, y+1) += err * 3/16
      // (x,   y+1) += err * 5/16
      // (x+1, y+1) += err * 1/16
      if (x + 1 < width) buffer[idxBuf + 1] += err * (7 / 16);
      if (x - 1 >= 0 && y + 1 < height) buffer[idxBuf - 1 + width] += err * (3 / 16);
      if (y + 1 < height) buffer[idxBuf + width] += err * (5 / 16);
      if (x + 1 < width && y + 1 < height) buffer[idxBuf + 1 + width] += err * (1 / 16);
    }
  }
  // Write back to imgData
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = Math.max(0, Math.min(255, Math.round(buffer[y * width + x])));
      data[i] = v; data[i + 1] = v; data[i + 2] = v; // keep alpha
    }
  }
}

function applyFloydSteinbergColor(imgData, palette) {
  const { data, width, height } = imgData;
  const size = width * height;
  const rBuf = new Float32Array(size);
  const gBuf = new Float32Array(size);
  const bBuf = new Float32Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const idx = y * width + x;
      rBuf[idx] = data[i];
      gBuf[idx] = data[i + 1];
      bBuf[idx] = data[i + 2];
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldR = rBuf[idx], oldG = gBuf[idx], oldB = bBuf[idx];
      const pIdx = nearestPaletteIndexRGB(oldR, oldG, oldB, palette);
      const pr = palette[pIdx][0], pg = palette[pIdx][1], pb = palette[pIdx][2];
      const errR = oldR - pr;
      const errG = oldG - pg;
      const errB = oldB - pb;
      rBuf[idx] = pr; gBuf[idx] = pg; bBuf[idx] = pb;
      // Diffuse error to neighbors (Floyd–Steinberg)
      // right
      if (x + 1 < width) {
        const n = idx + 1;
        rBuf[n] += errR * (7 / 16);
        gBuf[n] += errG * (7 / 16);
        bBuf[n] += errB * (7 / 16);
      }
      // bottom-left
      if (x - 1 >= 0 && y + 1 < height) {
        const n = idx - 1 + width;
        rBuf[n] += errR * (3 / 16);
        gBuf[n] += errG * (3 / 16);
        bBuf[n] += errB * (3 / 16);
      }
      // bottom
      if (y + 1 < height) {
        const n = idx + width;
        rBuf[n] += errR * (5 / 16);
        gBuf[n] += errG * (5 / 16);
        bBuf[n] += errB * (5 / 16);
      }
      // bottom-right
      if (x + 1 < width && y + 1 < height) {
        const n = idx + 1 + width;
        rBuf[n] += errR * (1 / 16);
        gBuf[n] += errG * (1 / 16);
        bBuf[n] += errB * (1 / 16);
      }
    }
  }
  // Write back
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const idx = y * width + x;
      data[i] = Math.max(0, Math.min(255, Math.round(rBuf[idx])));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(gBuf[idx])));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(bBuf[idx])));
    }
  }
}

function applyAtkinson(imgData, palette) {
  const { data, width, height } = imgData;
  const buffer = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      buffer[y * width + x] = toGrayscale(data[i], data[i + 1], data[i + 2]);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idxBuf = y * width + x;
      const old = buffer[idxBuf];
      const pIdx = nearestPaletteIndex(old, palette);
      const newVal = palette[pIdx][0];
      const err = (old - newVal) / 8; // Atkinson diffuses equally to six neighbors
      buffer[idxBuf] = newVal;
      // neighbors
      // (x+1,y), (x+2,y), (x-1,y+1), (x,y+1), (x+1,y+1), (x,y+2)
      if (x + 1 < width) buffer[idxBuf + 1] += err;
      if (x + 2 < width) buffer[idxBuf + 2] += err;
      if (x - 1 >= 0 && y + 1 < height) buffer[idxBuf - 1 + width] += err;
      if (y + 1 < height) buffer[idxBuf + width] += err;
      if (x + 1 < width && y + 1 < height) buffer[idxBuf + 1 + width] += err;
      if (y + 2 < height) buffer[idxBuf + 2 * width] += err;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = Math.max(0, Math.min(255, Math.round(buffer[y * width + x])));
      data[i] = v; data[i + 1] = v; data[i + 2] = v;
    }
  }
}

function applyAtkinsonColor(imgData, palette) {
  const { data, width, height } = imgData;
  const size = width * height;
  const rBuf = new Float32Array(size);
  const gBuf = new Float32Array(size);
  const bBuf = new Float32Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const idx = y * width + x;
      rBuf[idx] = data[i];
      gBuf[idx] = data[i + 1];
      bBuf[idx] = data[i + 2];
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldR = rBuf[idx], oldG = gBuf[idx], oldB = bBuf[idx];
      const pIdx = nearestPaletteIndexRGB(oldR, oldG, oldB, palette);
      const pr = palette[pIdx][0], pg = palette[pIdx][1], pb = palette[pIdx][2];
      const errR = (oldR - pr) / 8;
      const errG = (oldG - pg) / 8;
      const errB = (oldB - pb) / 8;
      rBuf[idx] = pr; gBuf[idx] = pg; bBuf[idx] = pb;
      // neighbors: (x+1,y), (x+2,y), (x-1,y+1), (x,y+1), (x+1,y+1), (x,y+2)
      if (x + 1 < width) {
        const n = idx + 1;
        rBuf[n] += errR; gBuf[n] += errG; bBuf[n] += errB;
      }
      if (x + 2 < width) {
        const n = idx + 2;
        rBuf[n] += errR; gBuf[n] += errG; bBuf[n] += errB;
      }
      if (x - 1 >= 0 && y + 1 < height) {
        const n = idx - 1 + width;
        rBuf[n] += errR; gBuf[n] += errG; bBuf[n] += errB;
      }
      if (y + 1 < height) {
        const n = idx + width;
        rBuf[n] += errR; gBuf[n] += errG; bBuf[n] += errB;
      }
      if (x + 1 < width && y + 1 < height) {
        const n = idx + 1 + width;
        rBuf[n] += errR; gBuf[n] += errG; bBuf[n] += errB;
      }
      if (y + 2 < height) {
        const n = idx + 2 * width;
        rBuf[n] += errR; gBuf[n] += errG; bBuf[n] += errB;
      }
    }
  }
  // Write back
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const idx = y * width + x;
      data[i] = Math.max(0, Math.min(255, Math.round(rBuf[idx])));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(gBuf[idx])));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(bBuf[idx])));
    }
  }
}

function applyDither() {
  if (!originalImage) return;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let palette;
  const paletteType = paletteSelect?.value || 'grayscale';
  const colors = parseInt(colorsSelect.value, 10);
  if (paletteType === 'grayscale') {
    palette = buildGrayscalePalette(colors);
  } else if (paletteType === 'retro4') {
    palette = buildRetro4Palette();
  } else if (paletteType === 'cga16') {
    palette = buildCga16Palette();
  } else {
    palette = buildGrayscalePalette(colors);
  }
  const algo = algorithmSelect.value;
  const working = new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);

  switch (algo) {
    case 'floyd-steinberg':
      if (paletteType === 'grayscale') {
        applyFloydSteinberg(working, palette);
      } else {
        applyFloydSteinbergColor(working, palette);
      }
      break;
    case 'atkinson':
      if (paletteType === 'grayscale') {
        applyAtkinson(working, palette);
      } else {
        applyAtkinsonColor(working, palette);
      }
      break;
    case 'threshold':
    default:
      if (paletteType === 'grayscale') {
        applyThresholdDither(working, palette);
      } else {
        // Threshold without diffusion using nearest color
        const { data, width, height } = working;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const idx = nearestPaletteIndexRGB(data[i], data[i + 1], data[i + 2], palette);
            const p = palette[idx];
            data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2];
          }
        }
      }
      break;
  }
  ctx.putImageData(working, 0, 0);
}

applyBtn.addEventListener('click', applyDither);

resetBtn.addEventListener('click', () => {
  if (!originalImage) return;
  imageToCanvas(originalImage);
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'dithered.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Auto apply wiring
function maybeAutoApply() {
  if (autoApply && autoApply.checked && originalImage) {
    applyDither();
  }
}

algorithmSelect.addEventListener('change', maybeAutoApply);
colorsSelect.addEventListener('change', maybeAutoApply);
if (paletteSelect) paletteSelect.addEventListener('change', maybeAutoApply);
if (autoApply) autoApply.addEventListener('change', maybeAutoApply);

// Theme switching
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('idt-theme', theme); } catch {}
}
function applyDensity(density) {
  document.documentElement.setAttribute('data-density', density);
  try { localStorage.setItem('idt-density', density); } catch {}
}
// Initialize persisted settings
try {
  const savedTheme = localStorage.getItem('idt-theme');
  const savedDensity = localStorage.getItem('idt-density');
  if (savedTheme && themeSelect) { themeSelect.value = savedTheme; }
  if (savedDensity && densitySelect) { densitySelect.value = savedDensity; }
} catch {}
applyTheme(themeSelect?.value || 'dark');
applyDensity(densitySelect?.value || 'comfortable');
if (themeSelect) {
  themeSelect.addEventListener('change', (e) => {
    const theme = e.target.value;
    applyTheme(theme);
  });
}
if (densitySelect) {
  densitySelect.addEventListener('change', (e) => {
    const density = e.target.value;
    applyDensity(density);
  });
}