// ImageToolsWebsite bootstrap

const tools = [
  {
    id: "image-ocr-extractor",
    name: "Image OCR Extractor",
    desc: "Extract text from images with local or cloud OCR.",
    path: "../image-ocr-extractor/",
    cat: "analyze",
    icon: "🔎",
  },
  {
    id: "image-dithering-tool",
    name: "Image Dithering Tool",
    desc: "Apply classic dithering patterns to images.",
    path: "../image-dithering-tool/",
    cat: "edit",
    icon: "🟣",
  },
  {
    id: "image-exif-tool",
    name: "Image EXIF Tool",
    desc: "View and strip EXIF metadata.",
    path: "../image-exif-tool/",
    cat: "analyze",
    icon: "📋",
  },
  {
    id: "image-pixel-sorter",
    name: "Image Pixel Sorter",
    desc: "Create glitch art via pixel sorting.",
    path: "../image-pixel-sorter/",
    cat: "edit",
    icon: "🧪",
  },
  {
    id: "image-ascii-art-converter",
    name: "ASCII Art Converter",
    desc: "Turn images into ASCII art.",
    path: "../image-ascii-art-converter/",
    cat: "convert",
    icon: "🔠",
  },
  {
    id: "image-anaglyph-3d",
    name: "Anaglyph 3D Maker",
    desc: "Create red-cyan 3D images.",
    path: "../image-anaglyph-3d/",
    cat: "edit",
    icon: "🕶️",
  },
  {
    id: "image-format-converter",
    name: "Format Converter",
    desc: "Convert PNG/JPG/WebP (Next.js app).",
    path: "../image-format-converter/",
    cat: "convert",
    icon: "🔄",
  },
  {
    id: "image-resizer",
    name: "Image Resizer",
    desc: "Resize images (Next.js app).",
    path: "../image-resizer/",
    cat: "edit",
    icon: "📐",
  },
  {
    id: "image-hidden-message",
    name: "Hidden Message Finder",
    desc: "Reveal hidden patterns (Next.js app).",
    path: "../image-hidden-message/",
    cat: "analyze",
    icon: "🕵️",
  },
];

function $(sel) { return document.querySelector(sel); }

function init() {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const grid = $("#toolsGrid");
  if (!grid) return;

  renderTools();
  setupSearchAndFilter();
  setupAdSensePlaceholder();
}

function checkToolAvailability(path) {
  // Assume available; avoid noisy network checks in console.
  // You can enable a real check later if desired.
  return true;
}

async function renderTools() {
  const grid = $("#toolsGrid");
  grid.innerHTML = "";
  const searchVal = $("#search")?.value?.toLowerCase() || "";
  const cat = $("#categoryFilter")?.value || "all";

  for (const tool of tools) {
    if (cat !== "all" && tool.cat !== cat) continue;
    if (searchVal && !(tool.name.toLowerCase().includes(searchVal) || tool.desc.toLowerCase().includes(searchVal))) continue;

    const available = checkToolAvailability(tool.path);
    const card = document.createElement("div");
    card.className = "card" + (available ? "" : " offline");
    card.innerHTML = `
      <div class="icon">${tool.icon || "🖼️"}</div>
      <div class="title">${tool.name}</div>
      <div class="desc">${tool.desc}</div>
      ${tool.desc.includes("Next.js") ? '<span class="badge">Server app</span>' : ''}
      <div class="actions">
        <a class="btn" href="${tool.path}" ${available ? "" : "aria-disabled=\"true\""}>${available ? "Open" : "Unavailable"}</a>
        ${available ? `<a class="btn" href="${tool.path}" target="_blank" rel="noopener">New Tab</a>` : ""}
      </div>
    `;
    grid.appendChild(card);
  }
}

function setupSearchAndFilter() {
  const search = $("#search");
  const filter = $("#categoryFilter");
  if (search) search.addEventListener("input", () => { renderTools(); });
  if (filter) filter.addEventListener("change", () => { renderTools(); });
}

function setupAdSensePlaceholder() {
  // Placeholder block already exists in HTML/CSS.
  // If you later add your AdSense script, it can replace this node.
  const ad = document.querySelector(".ad-placeholder");
  if (!ad) return;
  ad.title = "This is a placeholder for Google AdSense";
}

document.addEventListener("DOMContentLoaded", init);