const fileInput = document.getElementById('fileInput');
const modeSelect = document.getElementById('mode');
const sortSelectionBtn = document.getElementById('sortSelectionBtn');
const sortAllBtn = document.getElementById('sortAllBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const directionSelect = document.getElementById('direction');
const orderSelect = document.getElementById('order');
const strengthSlider = document.getElementById('strength');
const strengthVal = document.getElementById('strengthVal');

const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const octx = overlay.getContext('2d');

let img = null;
let selection = null; // {x,y,w,h}
let dragging = false;
let start = null;

function enableControls(enabled) {
  sortSelectionBtn.disabled = !enabled;
  sortAllBtn.disabled = !enabled;
  resetBtn.disabled = !enabled;
  downloadBtn.disabled = !enabled;
}

function clearOverlay() {
  octx.clearRect(0, 0, overlay.width, overlay.height);
}

function drawSelection() {
  clearOverlay();
  if (!selection) return;
  octx.strokeStyle = '#7aa2ff';
  octx.lineWidth = 2;
  octx.setLineDash([6, 6]);
  octx.strokeRect(selection.x, selection.y, selection.w, selection.h);
  octx.setLineDash([]);
}

function imageToCanvas(image) {
  const maxW = Math.min(window.innerWidth - 64, image.width);
  const scale = maxW / image.width;
  const w = Math.floor(image.width * scale);
  const h = Math.floor(image.height * scale);
  canvas.width = w;
  canvas.height = h;
  overlay.width = w;
  overlay.height = h;
  ctx.drawImage(image, 0, 0, w, h);
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      img = image;
      imageToCanvas(image);
      selection = null;
      enableControls(true);
      clearOverlay();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

overlay.addEventListener('mousedown', (e) => {
  if (!img) return;
  const rect = overlay.getBoundingClientRect();
  start = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  dragging = true;
});

overlay.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const rect = overlay.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = x - start.x;
  const h = y - start.y;
  selection = {
    x: Math.min(start.x, x),
    y: Math.min(start.y, y),
    w: Math.abs(w),
    h: Math.abs(h),
  };
  drawSelection();
});

overlay.addEventListener('mouseup', () => {
  dragging = false;
});

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function keyForMode(r, g, b, mode) {
  switch (mode) {
    case 'brightness': return r + g + b;
    case 'hue': return rgbToHsv(r, g, b).h;
    case 'red': return r;
    case 'green': return g;
    case 'blue': return b;
    default: return r + g + b;
  }
}

// Blend two colors by strength (0..1)
function blend(src, dst, t) {
  return [
    Math.round(src[0] * (1 - t) + dst[0] * t),
    Math.round(src[1] * (1 - t) + dst[1] * t),
    Math.round(src[2] * (1 - t) + dst[2] * t),
    Math.round(src[3] * (1 - t) + dst[3] * t),
  ];
}

function sortRegion(x, y, w, h, mode, direction, order, strengthPct) {
  if (w <= 0 || h <= 0) return;
  const imgData = ctx.getImageData(x, y, w, h);
  const data = imgData.data;
  const original = new Uint8ClampedArray(data); // preserve original
  const t = Math.min(Math.max(strengthPct / 100, 0), 1);

  const ascend = order === 'ascending';

  if (direction === 'rows') {
    for (let row = 0; row < h; row++) {
      const rowPixels = [];
      const base = row * w * 4;
      for (let col = 0; col < w; col++) {
        const i = base + col * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        rowPixels.push({ r, g, b, a, key: keyForMode(r, g, b, mode) });
      }
      rowPixels.sort((p1, p2) => ascend ? p1.key - p2.key : p2.key - p1.key);
      for (let col = 0; col < w; col++) {
        const i = base + col * 4;
        const dst = rowPixels[col];
        const src = [original[i], original[i + 1], original[i + 2], original[i + 3]];
        const blended = blend(src, [dst.r, dst.g, dst.b, dst.a], t);
        data[i] = blended[0]; data[i + 1] = blended[1]; data[i + 2] = blended[2]; data[i + 3] = blended[3];
      }
    }
  } else if (direction === 'columns') {
    for (let col = 0; col < w; col++) {
      const colPixels = [];
      for (let row = 0; row < h; row++) {
        const i = (row * w + col) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        colPixels.push({ r, g, b, a, key: keyForMode(r, g, b, mode) });
      }
      colPixels.sort((p1, p2) => ascend ? p1.key - p2.key : p2.key - p1.key);
      for (let row = 0; row < h; row++) {
        const i = (row * w + col) * 4;
        const dst = colPixels[row];
        const src = [original[i], original[i + 1], original[i + 2], original[i + 3]];
        const blended = blend(src, [dst.r, dst.g, dst.b, dst.a], t);
        data[i] = blended[0]; data[i + 1] = blended[1]; data[i + 2] = blended[2]; data[i + 3] = blended[3];
      }
    }
  } else {
    // Fallback: whole-region sort with blending
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      pixels.push({ r, g, b, a, key: keyForMode(r, g, b, mode) });
    }
    pixels.sort((p1, p2) => ascend ? p1.key - p2.key : p2.key - p1.key);
    for (let i = 0; i < data.length; i += 4) {
      const dst = pixels[i / 4];
      const src = [original[i], original[i + 1], original[i + 2], original[i + 3]];
      const blended = blend(src, [dst.r, dst.g, dst.b, dst.a], t);
      data[i] = blended[0]; data[i + 1] = blended[1]; data[i + 2] = blended[2]; data[i + 3] = blended[3];
    }
  }

  ctx.putImageData(imgData, x, y);
}

sortSelectionBtn.addEventListener('click', () => {
  if (!img || !selection) return;
  sortRegion(
    selection.x|0,
    selection.y|0,
    selection.w|0,
    selection.h|0,
    modeSelect.value,
    directionSelect.value,
    orderSelect.value,
    Number(strengthSlider.value)
  );
});

sortAllBtn.addEventListener('click', () => {
  if (!img) return;
  sortRegion(
    0,
    0,
    canvas.width,
    canvas.height,
    modeSelect.value,
    directionSelect.value,
    orderSelect.value,
    Number(strengthSlider.value)
  );
});

resetBtn.addEventListener('click', () => {
  if (!img) return;
  imageToCanvas(img);
  selection = null;
  clearOverlay();
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'pixel-sorted.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Enable overlay pointer events for selection
overlay.style.pointerEvents = 'auto';

// Strength label
strengthSlider.addEventListener('input', () => {
  strengthVal.textContent = `${strengthSlider.value}%`;
});