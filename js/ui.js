// js/ui.js
// UI helpers: canvas visibility, mode switching, reset

import {
  dropText,
  originalCanvas,
  originalCtx,
  previewCanvas,
  previewCtx,
  slicesContainer,
  modeSingleBtn,
  modeSheetBtn,
  toolSlice,
  resetBtn,
} from "./dom.js";
import { state, DEFAULT_TOLERANCE } from "./state.js";
import { clearHistory, updateUndoUI } from "./history.js";

export function showOriginalCanvas() {
  dropText.style.display = "none";
  originalCanvas.style.display = "block";
}

export function showPreviewCanvas() {
  previewCanvas.style.display = "block";
  slicesContainer.style.display = "none";
}

export function showSlicesPreview() {
  previewCanvas.style.display = "none";
  slicesContainer.style.display = "flex";
}

export function ensurePreviewReady() {
  if (previewCanvas.width && previewCanvas.height) return true;
  if (originalCanvas.width && originalCanvas.height) {
    previewCanvas.width = originalCanvas.width;
    previewCanvas.height = originalCanvas.height;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.drawImage(originalCanvas, 0, 0);
    showPreviewCanvas();
    return true;
  }
  return false;
}

// Compute bounding box of non-background / non-transparent pixels in preview
export function computeContentBBox() {
  if (!ensurePreviewReady()) return null;
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  const img = previewCtx.getImageData(0, 0, w, h);
  const data = img.data;
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  const bg =
    state.originalBgColor || { r: data[0], g: data[1], b: data[2] };
  const tol = Math.max(6, DEFAULT_TOLERANCE - 6);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      let isContent = false;
      if (a > 16) isContent = true;
      else {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (
          Math.abs(r - bg.r) > tol ||
          Math.abs(g - bg.g) > tol ||
          Math.abs(b - bg.b) > tol
        )
          isContent = true;
      }
      if (isContent) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// Mode switching: 'single' or 'sheet'
export function setMode(mode) {
  if (mode === state.currentMode) return;
  state.currentMode = mode;
  if (!modeSingleBtn || !modeSheetBtn) return;
  if (mode === "single") {
    modeSingleBtn.classList.add("active");
    modeSingleBtn.setAttribute("aria-selected", "true");
    modeSheetBtn.classList.remove("active");
    modeSheetBtn.setAttribute("aria-selected", "false");
    if (toolSlice) toolSlice.style.display = "none";
  } else {
    modeSheetBtn.classList.add("active");
    modeSheetBtn.setAttribute("aria-selected", "true");
    modeSingleBtn.classList.remove("active");
    modeSingleBtn.setAttribute("aria-selected", "false");
    if (toolSlice) toolSlice.style.display = "inline-block";
  }
}

export function clearPreviews() {
  slicesContainer.innerHTML = "";
  state.frames = [];
  state.lastCroppedDataURL = null;
  state.lastMetadata = null;
}

export function resetAll() {
  clearHistory();
  clearPreviews();

  if (originalCanvas.width && originalCanvas.height) {
    originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
  }
  if (previewCanvas.width && previewCanvas.height) {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }

  originalCanvas.width = 0;
  originalCanvas.height = 0;
  originalCanvas.style.display = "none";

  previewCanvas.width = 0;
  previewCanvas.height = 0;
  previewCanvas.style.display = "none";

  dropText.style.display = "block";

  state.frames = [];
  state.lastCroppedDataURL = null;
  state.lastMetadata = null;
  state.currentFileName = "sprite";
  state.lastOperation = null;
  state.lastGridCols = 0;
  state.lastGridRows = 0;
  updateUndoUI();
}

// Wire up mode buttons & reset
if (modeSingleBtn && modeSheetBtn) {
  modeSingleBtn.addEventListener("click", () => setMode("single"));
  modeSheetBtn.addEventListener("click", () => setMode("sheet"));
  setMode(state.currentMode);
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset and clear current image and edits?")) return;
    resetAll();
  });
}
