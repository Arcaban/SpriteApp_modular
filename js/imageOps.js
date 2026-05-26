// js/imageOps.js
// Image operations: Background removal, Auto Crop, Clean Sprite

import {
  bgBtn,
  cleanBtn,
  cropBtn,
  previewCanvas,
  previewCtx,
  originalCanvas,
} from "./dom.js";
import { state, DEFAULT_TOLERANCE } from "./state.js";
import { pushHistory } from "./history.js";
import {
  ensurePreviewReady,
  showPreviewCanvas,
  clearPreviews,
} from "./ui.js";

function getTolerance() {
  const el = document.getElementById("toleranceSlider");
  return el ? Math.max(1, parseInt(el.value, 10)) : DEFAULT_TOLERANCE;
}

function removeBackground() {
  const tolerance = getTolerance();
  const imgData = previewCtx.getImageData(
    0,
    0,
    previewCanvas.width,
    previewCanvas.height
  );
  const data = imgData.data;
  const bg = { r: data[0], g: data[1], b: data[2] };
  state.originalBgColor = bg;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) continue;
    if (
      Math.abs(r - bg.r) <= tolerance &&
      Math.abs(g - bg.g) <= tolerance &&
      Math.abs(b - bg.b) <= tolerance
    ) {
      data[i + 3] = 0;
    }
  }

  previewCtx.putImageData(imgData, 0, 0);
  state.lastOperation = "background-removed";
  showPreviewCanvas();
  clearPreviews();
}

function autoCrop() {
  const imgData = previewCtx.getImageData(
    0,
    0,
    previewCanvas.width,
    previewCanvas.height
  );
  const data = imgData.data;

  let minX = previewCanvas.width,
    minY = previewCanvas.height,
    maxX = -1,
    maxY = -1;

  for (let y = 0; y < previewCanvas.height; y++) {
    for (let x = 0; x < previewCanvas.width; x++) {
      const i = (y * previewCanvas.width + x) * 4;
      if (data[i + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) {
    const bg = { r: data[0], g: data[1], b: data[2] };
    const tol = Math.max(6, getTolerance() - 6);
    for (let y = 0; y < previewCanvas.height; y++) {
      for (let x = 0; x < previewCanvas.width; x++) {
        const i = (y * previewCanvas.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (
          Math.abs(r - bg.r) > tol ||
          Math.abs(g - bg.g) > tol ||
          Math.abs(b - bg.b) > tol
        ) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (maxX === -1) {
    alert("No visible sprite pixels detected. Try Remove Background first.");
    return;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = previewCtx.getImageData(minX, minY, cropW, cropH);
  previewCanvas.width = cropW;
  previewCanvas.height = cropH;
  previewCtx.putImageData(cropped, 0, 0);

  state.lastOperation = "cropped";
  showPreviewCanvas();
  state.lastCroppedDataURL = previewCanvas.toDataURL("image/png");
  state.lastMetadata = {
    originalWidth: originalCanvas.width,
    originalHeight: originalCanvas.height,
    croppedWidth: cropW,
    croppedHeight: cropH,
    offsetX: minX,
    offsetY: minY,
  };
}

const toleranceSlider = document.getElementById("toleranceSlider");
const toleranceDisplay = document.getElementById("toleranceDisplay");
if (toleranceSlider && toleranceDisplay) {
  toleranceSlider.addEventListener("input", () => {
    toleranceDisplay.textContent = toleranceSlider.value;
  });
}

if (bgBtn) {
  bgBtn.addEventListener("click", () => {
    if (!ensurePreviewReady()) return alert("Load an image first.");
    pushHistory();
    removeBackground();
  });
}

// Single pushHistory, then calls both operations directly — no triple-push bug
if (cleanBtn) {
  cleanBtn.addEventListener("click", () => {
    if (!ensurePreviewReady()) return alert("Load an image first.");
    pushHistory();
    removeBackground();
    autoCrop();
  });
}

if (cropBtn) {
  cropBtn.addEventListener("click", () => {
    if (!ensurePreviewReady()) return alert("Load an image first.");
    pushHistory();
    autoCrop();
  });
}
