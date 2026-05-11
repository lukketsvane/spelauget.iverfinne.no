'use client';

import { useEffect, useRef } from 'react';

// Renders an image with the same chunky-pixel feel as the in-game
// Three.js canvas: the source PNG is drawn into an offscreen-style
// canvas at a fraction of viewport resolution (DPR), then the
// browser scales the canvas back up to 100 % with image-rendering:
// pixelated so the upscale stays crisp.
//
// Without this, a high-res splash image looks smooth — at odds with
// the chunky in-game look. With it, the splash matches the game
// canvas exactly.

const DEFAULT_DPR = 0.45;

type Props = {
  src: string;
  // Effective render fraction. 0.45 = same as the Three.js canvas
  // dpr in Game.tsx; raise for finer pixels, lower for chunkier.
  dpr?: number;
  className?: string;
  alt?: string;
};

export default function PixelatedImage({
  src,
  dpr = DEFAULT_DPR,
  className,
  alt = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Cache the loaded HTMLImageElement so resize redraws don't have
  // to re-fetch / re-decode the source.
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      draw();
    };
    img.src = src;

    function draw() {
      const canvas = canvasRef.current;
      const source = imgRef.current;
      if (!canvas || !source) return;

      // Use the canvas's CSS-laid-out size as the target — this
      // matches whatever the parent container hands us, so the
      // pixelation stays consistent across viewports without
      // listening to window.resize directly.
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);

      // object-fit: cover behaviour — fill the canvas without
      // distorting aspect, cropping the longer source dimension.
      const sw = source.naturalWidth;
      const sh = source.naturalHeight;
      const srcAspect = sw / sh;
      const dstAspect = w / h;
      let drawW: number;
      let drawH: number;
      let drawX: number;
      let drawY: number;
      if (srcAspect > dstAspect) {
        // Source is wider than canvas → fit height, crop sides.
        drawH = h;
        drawW = drawH * srcAspect;
        drawX = (w - drawW) / 2;
        drawY = 0;
      } else {
        // Source is taller → fit width, crop top/bottom.
        drawW = w;
        drawH = drawW / srcAspect;
        drawX = 0;
        drawY = (h - drawH) / 2;
      }
      ctx.drawImage(source, drawX, drawY, drawW, drawH);
    }

    // Resize observer — redraws when the canvas's rendered size
    // changes (viewport resize, sidebar toggle, etc.). Cheaper than
    // a global window resize listener that fires per-frame on drag.
    const ro = new ResizeObserver(() => draw());
    if (canvasRef.current) ro.observe(canvasRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [src, dpr]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      className={className}
      // image-rendering: pixelated keeps the canvas-to-CSS upscale
      // crisp, mirroring how the Three.js canvas is rendered.
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
