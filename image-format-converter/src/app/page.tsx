"use client";

import React from "react";

type TargetFormat =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/bmp"
  | "image/gif"
  | "image/svg+xml";

const formatOptions: { label: string; value: TargetFormat }[] = [
  { label: "PNG", value: "image/png" },
  { label: "JPEG", value: "image/jpeg" },
  { label: "WEBP", value: "image/webp" },
  { label: "BMP", value: "image/bmp" },
  { label: "GIF", value: "image/gif" },
  { label: "SVG", value: "image/svg+xml" },
];

export default function Page() {
  const [file, setFile] = React.useState<File | null>(null);
  const [srcUrl, setSrcUrl] = React.useState<string | null>(null);
  const [targetFormat, setTargetFormat] = React.useState<TargetFormat>("image/png");
  const [outputUrl, setOutputUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onPick = () => inputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setOutputUrl(null);
    setSrcUrl(f ? URL.createObjectURL(f) : null);
  };

  const convert = async () => {
    if (!file || !srcUrl) return;
    setBusy(true);
    try {
      // Use canvas for raster formats; for SVG, just pass through.
      if (targetFormat === "image/svg+xml") {
        // If source is raster, we cannot create true SVG easily; skip.
        // Just provide original if already SVG.
        const isSvg = file.type === "image/svg+xml";
        if (isSvg) {
          const blob = new Blob([await file.arrayBuffer()], { type: "image/svg+xml" });
          setOutputUrl(URL.createObjectURL(blob));
        } else {
          alert("SVG conversion from raster isn't supported in-browser.");
        }
        return;
      }

      const img = await loadImage(srcUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, targetFormat, targetFormat === "image/jpeg" ? 0.92 : undefined)
      );
      if (!blob) throw new Error("Conversion failed");
      setOutputUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      alert("Conversion failed. Please try another format.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="hero bg-base-200 rounded-xl border border-base-300">
        <div className="hero-content text-center">
          <div className="max-w-xl space-y-3">
            <h2 className="text-3xl font-semibold">Convert Images Instantly</h2>
            <p className="text-base-content/70">Upload, preview, choose a target format, and download — all locally.</p>
            <div className="flex items-center justify-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
              />
              <button className="btn btn-primary" onClick={onPick}>
                Choose File
              </button>
              {file && <span className="badge badge-outline truncate max-w-[16rem]">{file.name}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h3 className="card-title">Source Preview</h3>
            {!srcUrl ? (
              <div className="alert alert-info">
                <span>No image selected. Pick a file to preview.</span>
              </div>
            ) : (
              <figure className="border rounded-xl overflow-hidden h-48 bg-base-300 flex items-center justify-center">
                <img
                  src={srcUrl}
                  alt="Source preview"
                  className="max-h-full max-w-full object-contain"
                />
              </figure>
            )}
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h3 className="card-title">Output Preview</h3>
            {!outputUrl ? (
              <div className="alert alert-success">
                <span>Converted image will appear here.</span>
              </div>
            ) : (
              <figure className="border rounded-xl overflow-hidden h-48 bg-base-300 flex items-center justify-center">
                <img
                  src={outputUrl}
                  alt="Output preview"
                  className="max-h-full max-w-full object-contain"
                />
              </figure>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          <label className="label">
            <span className="label-text font-semibold">Choose Target Format</span>
          </label>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <select
              className="select select-bordered"
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as TargetFormat)}
            >
              {formatOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!file || busy} onClick={convert}>
              {busy ? "Converting..." : "Convert"}
            </button>
            {outputUrl && (
              <a className="btn btn-outline" href={outputUrl} download={downloadName(file, targetFormat)}>
                Download
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          <h4 className="font-semibold">Sponsored</h4>
          <div className="border rounded-xl p-4 text-center opacity-70">
            Google Ads slot placeholder
          </div>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downloadName(file: File | null, fmt: TargetFormat): string {
  const base = (file?.name || "converted").replace(/\.[^.]+$/, "");
  const ext = mimeToExt(fmt);
  return `${base}.${ext}`;
}

function mimeToExt(mime: TargetFormat): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/bmp":
      return "bmp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
  }
}