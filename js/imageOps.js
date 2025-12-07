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

if (bgBtn) {
  bgBtn.addEventListener("click", () => {
    if (!ensurePreviewReady()) return alert("Load an image first.");
    pushHistory();

    const tolerance = DEFAULT_TOLERANCE;
    const imgData = previewCtx.getImageData(
      0,
      0,
      previewCanvas.width,
      previewCanvas.height
    );
    const data = imgData.data;

    // Sample background color from top-left corner
    const bg = { r: data[0], g: data[1], b: data[2] };
    state.originalBgColor = bg;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (a === 0) continue;
      const match =
        Math.abs(r - bg.r) <= tolerance &&
        Math.abs(g - bg.g) <= tolerance &&
        Math.abs(b - bg.b) <= tolerance;
      if (match) data[i + 3] = 0;
    }

    previewCtx.putImageData(imgData, 0, 0);
    state.lastOperation = "background-removed";
    showPreviewCanvas();
    clearPreviews();
  });
}

if (cleanBtn) {
  cleanBtn.addEventListener("click", async () => {
    if (!ensurePreviewReady()) return alert("Load an image first.");
    pushHistory();
    bgBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    cropBtn.click();
  });
}

if (cropBtn) {
  cropBtn.addEventListener("click", () => {
    if (!ensurePreviewReady()) return alert("Load an image first.");
    pushHistory();

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
        const a = data[i + 3];
        if (a !== 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1) {
      const bg = { r: data[0], g: data[1], b: data[2] };
      const tol = Math.max(6, DEFAULT_TOLERANCE - 6);

      for (let y = 0; y < previewCanvas.height; y++) {
        for (let x = 0; x < previewCanvas.width; x++) {
          const i = (y * previewCanvas.width + x) * 4;
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          const isBg =
            Math.abs(r - bg.r) <= tol &&
            Math.abs(g - bg.g) <= tol &&
            Math.abs(b - bg.b) <= tol;
          if (!isBg) {
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
  });
}
