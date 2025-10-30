"use client";
import React, { useEffect, useRef, useState } from "react";

type Screen = "encode" | "decode";

function textToBits(text: string): number[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const bits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits.push((bytes[i] >> b) & 1);
    }
  }
  return bits;
}

function bitsToText(bits: number[]): string {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits[i + b] || 0);
    }
    bytes.push(byte);
  }
  const decoder = new TextDecoder();
  try {
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    return "";
  }
}

function embedLSB(imageData: ImageData, message: string): ImageData {
  const bits = textToBits(message);
  const length = bits.length;
  const data = imageData.data;

  // Store bit length in first 32 bits (RGBA channels sequentially)
  for (let i = 0; i < 32; i++) {
    const bit = (length >> (31 - i)) & 1;
    data[i] = (data[i] & 0xfe) | bit; // modify least significant bit
  }

  let di = 32; // start after header
  for (let i = 0; i < bits.length && di < data.length; i++, di++) {
    data[di] = (data[di] & 0xfe) | bits[i];
  }
  return new ImageData(data, imageData.width, imageData.height);
}

function extractLSB(imageData: ImageData): string {
  const data = imageData.data;
  let length = 0;
  for (let i = 0; i < 32; i++) {
    length = (length << 1) | (data[i] & 1);
  }
  const bits: number[] = [];
  let di = 32;
  for (let i = 0; i < length && di < data.length; i++, di++) {
    bits.push(data[di] & 1);
  }
  return bitsToText(bits);
}

function CapacityBar({ source, message }: { source: string; message: string }) {
  const [capacityBits, setCapacityBits] = useState<number>(0);
  const [needBits, setNeedBits] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    async function calc() {
      try {
        if (!source) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = source;
        await img.decode();
        const off = document.createElement("canvas");
        off.width = img.width;
        off.height = img.height;
        const ctx = off.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, off.width, off.height);
        const maxBits = imageData.data.length - 32;
        const bitsNeeded = textToBits(message || "").length;
        if (!cancelled) {
          setCapacityBits(maxBits);
          setNeedBits(bitsNeeded);
        }
      } catch {
        if (!cancelled) {
          setCapacityBits(0);
          setNeedBits(0);
        }
      }
    }
    calc();
    return () => { cancelled = true; };
  }, [source, message]);
  const pct = capacityBits > 0 ? Math.min(100, Math.round((needBits / capacityBits) * 100)) : 0;
  const capacityBytes = Math.max(0, Math.floor(capacityBits / 8));
  const needBytes = Math.max(0, Math.ceil(needBits / 8));
  return (
    <div>
      <div className="text-sm text-slate-600 mb-2">Capacity: {capacityBytes} bytes • Message: {needBytes} bytes</div>
      <div className="h-2 w-full border rounded-full">
        <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-sm text-slate-600 mt-1">Usage: {pct}%</div>
    </div>
  );
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("encode");
  const [source, setSource] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<string>("");
  const [decodedBits, setDecodedBits] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const decodeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setError(null);
    setResultUrl(null);
    setDecoded("");
  }, [screen]);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSource(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onEncode = async () => {
    try {
      setError(null);
      if (!source) return setError("Please upload an image first.");
      if (!message || message.length < 1) return setError("Enter a message to embed.");
      if (message.length > 200) return setError("Message too long. Limit 200 characters.");

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = source;
      await img.decode();

      const canvas = canvasRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const maxBits = imageData.data.length - 32; // one bit per channel minus header
      const needBits = textToBits(message).length;
      if (needBits > maxBits) {
        return setError("Image too small for this message. Try shorter text or larger image.");
      }

      const embedded = embedLSB(imageData, message);
      ctx.putImageData(embedded, 0, 0);
      const url = canvas.toDataURL("image/png");
      setResultUrl(url);
    } catch (e) {
      setError("Failed to encode. Try another image.");
    }
  };

  const onDecodeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSource(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onDecode = async () => {
    try {
      setError(null);
      if (!source) return setError("Please upload an encoded image.");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = source;
      await img.decode();
      const canvas = decodeCanvasRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Read header to set decodedBits as well
      const data = imageData.data;
      let length = 0;
      for (let i = 0; i < 32; i++) {
        length = (length << 1) | (data[i] & 1);
      }
      setDecodedBits(length);
      const text = extractLSB(imageData);
      setDecoded(text || "No message detected.");
    } catch (e) {
      setError("Failed to decode. Make sure image was encoded here.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Hide a Message in an Image</h2>
          <p className="text-sm text-slate-600">Two-screen app: encode and decode using LSB steganography</p>
        </div>
        <div className="space-x-2">
          <button
            className={`px-4 py-2 rounded ${screen === "encode" ? "bg-blue-600 text-white" : "bg-white border"}`}
            onClick={() => setScreen("encode")}
          >
            Encode
          </button>
          <button
            className={`px-4 py-2 rounded ${screen === "decode" ? "bg-blue-600 text-white" : "bg-white border"}`}
            onClick={() => setScreen("decode")}
          >
            Decode
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 p-3 mb-4">{error}</div>
      )}

      {screen === "encode" ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600 mb-2">Upload image (PNG/JPEG)</p>
            <input type="file" accept="image/*" onChange={onUpload} />
            <p className="text-sm text-slate-600 mt-4">Enter message (max 200 chars)</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2 w-full rounded border p-2"
              rows={4}
              maxLength={200}
              placeholder="Type a secret message..."
            />
            {source && (
              <div className="mt-3 p-3 rounded border bg-slate-50">
                <p className="text-sm text-slate-600 mb-1">Capacity & Progress</p>
                <CapacityBar source={source} message={message} canvasRef={canvasRef} />
              </div>
            )}
            <button onClick={onEncode} className="mt-4 rounded bg-blue-600 text-white px-4 py-2">Embed Message</button>
            {resultUrl && (
              <a href={resultUrl} download="encoded.png" className="mt-3 inline-block rounded bg-slate-800 text-white px-4 py-2">Download Encoded Image</a>
            )}
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600 mb-2">Preview & Canvas</p>
            {source && <img src={source} alt="source" className="rounded border mb-2" />}
            <canvas ref={canvasRef} className="w-full rounded border" />
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600 mb-2">Upload encoded image</p>
            <input type="file" accept="image/*" onChange={onDecodeUpload} />
            <button onClick={onDecode} className="mt-4 rounded bg-blue-600 text-white px-4 py-2">Reveal Message</button>
            {decoded && (
              <div className="mt-4 rounded border bg-slate-50 p-3">
                <p className="text-sm text-slate-600 mb-1">Decoded message</p>
                <p className="font-mono">{decoded}</p>
                <p className="text-sm text-slate-600 mt-2">Bits detected: {decodedBits}</p>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600 mb-2">Preview & Canvas</p>
            {source && <img src={source} alt="encoded" className="rounded border mb-2" />}
            <canvas ref={decodeCanvasRef} className="w-full rounded border" />
          </div>
        </div>
      )}
    </div>
  );
}