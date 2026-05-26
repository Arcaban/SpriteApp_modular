// js/gifExport.js
// Export sliced frames as an animated GIF using gif.js

import { state } from "./state.js";

const gifBtn = document.getElementById("gifBtn");

function getAnimFps() {
  const el = document.getElementById("animFpsInput");
  return el ? Math.max(1, parseInt(el.value, 10) || 12) : 12;
}

function setGifBtnState(loading, progress) {
  if (!gifBtn) return;
  if (loading) {
    gifBtn.disabled = true;
    gifBtn.textContent = progress != null ? `GIF ${Math.round(progress * 100)}%…` : "Building GIF…";
  } else {
    gifBtn.disabled = false;
    gifBtn.textContent = "Export GIF";
  }
}

async function loadImage(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = dataURL;
  });
}

export async function exportGif() {
  if (!state.frames || state.frames.length === 0) {
    alert("Slice the sprite sheet first, then export as GIF.");
    return;
  }

  const fps = getAnimFps();
  // GIF delay is in centiseconds (1/100 s)
  const delayCentiseconds = Math.max(2, Math.round(100 / fps));

  setGifBtnState(true, null);

  const fw = state.frames[0].w;
  const fh = state.frames[0].h;

  const gif = new GIF({
    workers: 2,
    quality: 5,
    workerScript: "vendor/gif.worker.js",
    width: fw,
    height: fh,
    repeat: 0, // loop forever
  });

  gif.on("progress", (p) => setGifBtnState(true, p));

  gif.on("finished", (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.currentFileName}_animation.gif`;
    a.click();
    URL.revokeObjectURL(url);
    setGifBtnState(false);
  });

  // Render each frame onto a white-background canvas before adding to GIF.
  // GIF only supports 1-bit transparency; a white background is universally safe.
  for (const frame of state.frames) {
    const img = await loadImage(frame.dataURL);
    const canvas = document.createElement("canvas");
    canvas.width = fw;
    canvas.height = fh;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, fw, fh);
    ctx.drawImage(img, 0, 0);
    gif.addFrame(canvas, { delay: delayCentiseconds * 10, copy: true });
  }

  gif.render();
}

if (gifBtn) {
  gifBtn.addEventListener("click", exportGif);
}
