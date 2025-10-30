"use client";

import { useEffect, useRef, useState } from "react";

export default function Page() {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const draggingRef = useRef(false);

  const [fileName, setFileName] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [offset, setOffset] = useState(12); // depth offset in pixels
  const [previewMode, setPreviewMode] = useState("anaglyph"); // "original" | "anaglyph" | "compare"
  const [splitRatio, setSplitRatio] = useState(0.5); // 0..1 for compare slider
  const [error, setError] = useState("");

  useEffect(() => {
    if (imgLoaded) {
      render();
    }
  }, [imgLoaded, offset, previewMode, splitRatio]);

  const onFileChange = (e) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (imgRef.current) {
        imgRef.current.onload = () => {
          setImgLoaded(true);
          render();
        };
        imgRef.current.src = reader.result;
      }
    };
    reader.onerror = () => setError("Failed to read image file.");
    reader.readAsDataURL(file);
  };

  const renderOriginal = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgRef.current, 0, 0, w, h);
  };

  const renderAnaglyph = (ctx, w, h) => {
    // Prepare offscreen canvases
    const canvasR = document.createElement("canvas");
    const canvasC = document.createElement("canvas");
    canvasR.width = w; canvasR.height = h;
    canvasC.width = w; canvasC.height = h;
    const ctxR = canvasR.getContext("2d");
    const ctxC = canvasC.getContext("2d");

    // Draw shifted layers
    const off = Math.max(0, Math.min(64, offset));
    ctxR.drawImage(imgRef.current, -off, 0, w + off, h); // shift right layer leftwards
    ctxC.drawImage(imgRef.current, off, 0, w - off, h);  // shift left layer rightwards

    const imgDataR = ctxR.getImageData(0, 0, w, h);
    const imgDataC = ctxC.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);

    const rData = imgDataR.data;
    const cData = imgDataC.data;
    const oData = out.data;

    // Combine channels: red from R, green/blue from C
    for (let i = 0; i < oData.length; i += 4) {
      oData[i] = rData[i];        // R
      oData[i + 1] = cData[i + 1]; // G
      oData[i + 2] = cData[i + 2]; // B
      oData[i + 3] = Math.max(rData[i + 3], cData[i + 3]); // A
    }

    ctx.putImageData(out, 0, 0);
  };

  const renderCompare = (ctx, w, h) => {
    const img = imgRef.current;
    if (!img) return;

    // Prepare original canvas
    const canvasO = document.createElement("canvas");
    canvasO.width = w; canvasO.height = h;
    const ctxO = canvasO.getContext("2d");
    ctxO.drawImage(img, 0, 0, w, h);

    // Prepare anaglyph canvas
    const canvasA = document.createElement("canvas");
    canvasA.width = w; canvasA.height = h;
    const ctxA = canvasA.getContext("2d");

    const canvasR = document.createElement("canvas");
    const canvasC = document.createElement("canvas");
    canvasR.width = w; canvasR.height = h;
    canvasC.width = w; canvasC.height = h;
    const ctxR = canvasR.getContext("2d");
    const ctxC = canvasC.getContext("2d");

    const off = Math.max(0, Math.min(64, offset));
    ctxR.drawImage(img, -off, 0, w + off, h);
    ctxC.drawImage(img, off, 0, w - off, h);

    const imgDataR = ctxR.getImageData(0, 0, w, h);
    const imgDataC = ctxC.getImageData(0, 0, w, h);
    const out = ctxA.createImageData(w, h);
    const rData = imgDataR.data;
    const cData = imgDataC.data;
    const oData = out.data;

    for (let i = 0; i < oData.length; i += 4) {
      oData[i] = rData[i];
      oData[i + 1] = cData[i + 1];
      oData[i + 2] = cData[i + 2];
      oData[i + 3] = Math.max(rData[i + 3], cData[i + 3]);
    }
    ctxA.putImageData(out, 0, 0);

    // Draw original across the whole canvas
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(canvasO, 0, 0);

    // Draw anaglyph up to split point
    const splitPx = Math.max(0, Math.min(w, Math.round(w * splitRatio)));
    if (splitPx > 0) {
      ctx.drawImage(canvasA, 0, 0, splitPx, h, 0, 0, splitPx, h);
    }

    // Draw slider handle
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitPx + 0.5, 0);
    ctx.lineTo(splitPx + 0.5, h);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(splitPx, h / 2, Math.max(8, Math.min(16, Math.round(w * 0.02))), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();
    ctx.restore();
  };

  const render = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    if (previewMode === "original") {
      renderOriginal(ctx, w, h);
    } else if (previewMode === "anaglyph") {
      renderAnaglyph(ctx, w, h);
    } else {
      renderCompare(ctx, w, h);
    }
  };

  const onDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? fileName.replace(/\.[^.]+$/, "") + "-anaglyph.png" : "anaglyph.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="card space-y-12">
      <div className="grid-2 gap-16">
        <div className="space-y-8">
          <label className="block text-sm text-muted">Upload Image</label>
          <input type="file" accept="image/*" onChange={onFileChange} className="input" />
          {error && <div className="alert">{error}</div>}
          <div className="space-y-8">
            <label className="block text-sm text-muted">Depth Offset: {offset}px</label>
            <input
              type="range"
              min="0"
              max="64"
              value={offset}
              onChange={(e) => setOffset(parseInt(e.target.value || "0", 10))}
              className="range"
            />
          </div>
          <div className="inline-flex items-center gap-8">
            <button
              className={`btn ${previewMode === "anaglyph" ? "btn-primary" : ""}`}
              onClick={() => setPreviewMode("anaglyph")}
            >
              Preview Anaglyph
            </button>
            <button
              className={`btn ${previewMode === "original" ? "btn-primary" : ""}`}
              onClick={() => setPreviewMode("original")}
            >
              Preview Original
            </button>
            <button
              className={`btn ${previewMode === "compare" ? "btn-primary" : ""}`}
              onClick={() => setPreviewMode("compare")}
              disabled={!imgLoaded}
            >
              Compare Split
            </button>
            <button className="btn" onClick={onDownload} disabled={!imgLoaded}>
              Download
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div
            className="canvas-wrap"
            onMouseDown={(e) => {
              if (previewMode !== "compare") return;
              draggingRef.current = true;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const w = rect.width;
              setSplitRatio(Math.max(0, Math.min(1, x / w)));
            }}
            onMouseMove={(e) => {
              if (previewMode !== "compare" || !draggingRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const w = rect.width;
              setSplitRatio(Math.max(0, Math.min(1, x / w)));
            }}
            onMouseUp={() => { draggingRef.current = false; }}
            onMouseLeave={() => { draggingRef.current = false; }}
            onTouchStart={(e) => {
              if (previewMode !== "compare") return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.touches[0].clientX - rect.left;
              const w = rect.width;
              setSplitRatio(Math.max(0, Math.min(1, x / w)));
            }}
            onTouchMove={(e) => {
              if (previewMode !== "compare") return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.touches[0].clientX - rect.left;
              const w = rect.width;
              setSplitRatio(Math.max(0, Math.min(1, x / w)));
            }}
            onTouchEnd={() => { draggingRef.current = false; }}
          >
            <canvas ref={canvasRef} className="canvas" />
          </div>
          <img ref={imgRef} alt="source" style={{ display: "none" }} />
        </div>
      </div>
      <p className="text-sm text-muted">
        Tip: Use red-cyan 3D glasses to view the anaglyph. Adjust depth offset for stronger or subtler 3D. Try Compare Split to drag a divider between original and anaglyph.
      </p>
    </div>
  );
}