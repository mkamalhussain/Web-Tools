// Image EXIF Tool - Client-side app with minimal dependencies

// Elements
const fileInput = document.getElementById('fileInput');
const dropArea = document.getElementById('dropArea');
const errorMessage = document.getElementById('errorMessage');
const preview = document.getElementById('preview');
const metadataBody = document.getElementById('metadataBody');
const metadataEmpty = document.getElementById('metadataEmpty');
const downloadClean = document.getElementById('downloadClean');
const clearBtn = document.getElementById('clearBtn');

// State
let currentFile = null;
let objectUrl = null;

// Helpers
function setError(msg) {
  errorMessage.textContent = msg || '';
}

function clearUI() {
  setError('');
  preview.src = '';
  preview.style.display = 'none';
  metadataBody.innerHTML = '';
  metadataEmpty.textContent = 'No EXIF data loaded.';
  currentFile = null;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function isValidJPEG(file) {
  return file && file.type === 'image/jpeg' && file.size <= 10 * 1024 * 1024;
}

function formatFraction(value) {
  if (!value) return '';
  if (typeof value === 'number') return value.toFixed(2);
  if (Array.isArray(value) && value.length === 2) {
    const [num, den] = value;
    if (den === 0) return `${num}`;
    return (num / den).toFixed(2);
  }
  return String(value);
}

function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const [d, m, s] = dms.map(formatFraction).map(parseFloat);
  if ([d, m, s].some(isNaN)) return null;
  let dec = d + m / 60 + s / 3600;
  if (ref === 'S' || ref === 'W') dec *= -1;
  return dec;
}

function formatGPS(lat, latRef, lon, lonRef) {
  const latDec = dmsToDecimal(lat, latRef);
  const lonDec = dmsToDecimal(lon, lonRef);
  if (latDec == null || lonDec == null) return null;
  const latStr = `${Math.abs(latDec).toFixed(4)}°${latDec >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lonDec).toFixed(4)}°${lonDec >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

function renderMetadata(tags) {
  metadataBody.innerHTML = '';
  const rows = [];
  const push = (label, value) => {
    if (value == null || value === '') return;
    rows.push(`<tr><td>${label}</td><td>${value}</td></tr>`);
  };

  push('Camera Make', tags.Make);
  push('Camera Model', tags.Model);
  push('Date/Time', tags.DateTime || tags.CreateDate || tags.ModifyDate);
  push('Aperture', tags.FNumber ? `f/${formatFraction(tags.FNumber)}` : null);
  push('Shutter Speed', tags.ExposureTime ? `${formatFraction(tags.ExposureTime)}s` : null);
  push('ISO', tags.ISO);
  push('Focal Length', tags.FocalLength ? `${formatFraction(tags.FocalLength)}mm` : null);
  const gps = formatGPS(tags.GPSLatitude, tags.GPSLatitudeRef, tags.GPSLongitude, tags.GPSLongitudeRef);
  push('GPS', gps);

  if (rows.length === 0) {
    metadataEmpty.textContent = 'No EXIF data found.';
  } else {
    metadataEmpty.textContent = '';
    metadataBody.innerHTML = rows.join('');
  }
}

// Minimal EXIF parsing: attempt to read common tags using a small parser.
// For simplicity and robustness, we leverage an inline minimal parser for JPEG APP1/EXIF.
// Note: This is minimal and focused on common tags; not a full EXIF implementation.

const TAGS = {
  0x010F: 'Make',
  0x0110: 'Model',
  0x0132: 'DateTime',
  0x829A: 'ExposureTime',
  0x829D: 'FNumber',
  0x8827: 'ISO',
  0x920A: 'FocalLength',
};

const GPS_TAGS = {
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
};

function readUint16(dataView, offset, little) {
  return little ? dataView.getUint16(offset, true) : dataView.getUint16(offset, false);
}
function readUint32(dataView, offset, little) {
  return little ? dataView.getUint32(offset, true) : dataView.getUint32(offset, false);
}
function readIFDEntry(dataView, offset, little, base) {
  const tag = readUint16(dataView, offset, little);
  const type = readUint16(dataView, offset + 2, little);
  const count = readUint32(dataView, offset + 4, little);
  const valueOffset = offset + 8;
  const valueOrOffset = readUint32(dataView, valueOffset, little);

  const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }; // BYTE, ASCII, SHORT, LONG, RATIONAL
  const size = TYPE_SIZES[type] * count;
  let valueBytesOffset = size > 4 ? base + valueOrOffset : valueOffset;

  function readValue() {
    switch (type) {
      case 2: { // ASCII
        const bytes = new Uint8Array(dataView.buffer, valueBytesOffset, count);
        let str = '';
        for (let i = 0; i < bytes.length; i++) { if (bytes[i] === 0) break; str += String.fromCharCode(bytes[i]); }
        return str;
      }
      case 3: { // SHORT
        if (count === 1) return readUint16(dataView, valueBytesOffset, little);
        const arr = [];
        for (let i = 0; i < count; i++) arr.push(readUint16(dataView, valueBytesOffset + i * 2, little));
        return arr;
      }
      case 4: { // LONG
        if (count === 1) return readUint32(dataView, valueBytesOffset, little);
        const arr = [];
        for (let i = 0; i < count; i++) arr.push(readUint32(dataView, valueBytesOffset + i * 4, little));
        return arr;
      }
      case 5: { // RATIONAL
        const arr = [];
        for (let i = 0; i < count; i++) {
          const num = readUint32(dataView, valueBytesOffset + i * 8, little);
          const den = readUint32(dataView, valueBytesOffset + i * 8 + 4, little);
          arr.push([num, den]);
        }
        if (count === 1) return arr[0];
        return arr;
      }
      case 1: { // BYTE
        const arr = new Uint8Array(dataView.buffer, valueBytesOffset, count);
        if (count === 1) return arr[0];
        return Array.from(arr);
      }
      default:
        return null;
    }
  }

  return { tag, type, count, value: readValue() };
}

function parseEXIF(arrayBuffer) {
  try {
    const dataView = new DataView(arrayBuffer);
    let offset = 2; // skip SOI 0xFFD8
    const length = dataView.byteLength;
    while (offset < length) {
      const marker = dataView.getUint16(offset, false);
      offset += 2;
      if (marker === 0xFFE1) { // APP1
        const size = dataView.getUint16(offset, false);
        const exifStart = offset + 2;
        // Check EXIF header
        const exifHeader = new TextDecoder('ascii').decode(new Uint8Array(arrayBuffer, exifStart, 6));
        if (!exifHeader.startsWith('Exif\u0000\u0000')) break;
        const tiffStart = exifStart + 6;
        const little = new TextDecoder('ascii').decode(new Uint8Array(arrayBuffer, tiffStart, 2)) === 'II';
        const firstIFDOffset = readUint32(dataView, tiffStart + 4, little);
        const ifd0 = tiffStart + firstIFDOffset;
        const numEntries = readUint16(dataView, ifd0, little);
        const tags = {};
        for (let i = 0; i < numEntries; i++) {
          const entry = readIFDEntry(dataView, ifd0 + 2 + i * 12, little, tiffStart);
          const name = TAGS[entry.tag];
          if (name) tags[name] = entry.value;
          if (entry.tag === 0x8825) { // GPS IFD pointer
            const gpsOffset = Array.isArray(entry.value) ? entry.value[0] : entry.value;
            const gpsIfd = tiffStart + gpsOffset;
            const gpsCount = readUint16(dataView, gpsIfd, little);
            for (let g = 0; g < gpsCount; g++) {
              const gEntry = readIFDEntry(dataView, gpsIfd + 2 + g * 12, little, tiffStart);
              const gName = GPS_TAGS[gEntry.tag];
              if (gName) tags[gName] = gEntry.value;
            }
          }
        }
        return tags;
      } else {
        const segmentSize = dataView.getUint16(offset, false);
        offset += segmentSize;
      }
    }
    return {};
  } catch (e) {
    console.warn('EXIF parse error:', e);
    return {};
  }
}

async function handleFile(file) {
  if (!isValidJPEG(file)) {
    if (!file) return;
    if (file.type !== 'image/jpeg') setError('Please upload a JPEG image.');
    else if (file.size > 10 * 1024 * 1024) setError('File too large. Max 10MB.');
    clearUI();
    return;
  }
  setError('');
  currentFile = file;

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  preview.src = objectUrl;
  preview.style.display = 'block';

  // Read ArrayBuffer for EXIF
  const arrayBuffer = await file.arrayBuffer();
  const tags = parseEXIF(arrayBuffer);
  renderMetadata(tags);
}

// Canvas redraw to strip EXIF
async function downloadWithoutEXIF() {
  if (!currentFile) return;
  const img = new Image();
  img.src = objectUrl;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'image_no_exif.jpg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  const dt = e.dataTransfer;
  const files = dt?.files;
  if (files && files[0]) handleFile(files[0]);
});
dropArea.addEventListener('click', () => fileInput.click());

// File input
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) handleFile(file);
});

// Actions
downloadClean.addEventListener('click', downloadWithoutEXIF);
clearBtn.addEventListener('click', () => { clearUI(); fileInput.value = ''; });

// Init
clearUI();