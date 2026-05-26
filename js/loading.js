// js/loading.js
// File loading & drop-zone

import {
  dropZone,
  dropText,
  fileInput,
  originalCanvas,
  originalCtx,
  previewCanvas,
  previewCtx,
} from "./dom.js";
import { state } from "./state.js";
import { clearHistory, updateUndoUI } from "./history.js";
import { clearPreviews, showOriginalCanvas, showPreviewCanvas } from "./ui.js";

export function loadImage(file) {
  clearHistory();
  clearPreviews();
  state.originalBgColor = null;
  state.currentFileName =
    file.name.split(".").slice(0, -1).join(".") || "sprite";

  const img = new Image();
  const objectURL = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(objectURL);
    // size ORIGINAL canvas to image's natural size (never changes)
    originalCanvas.width = img.naturalWidth;
    originalCanvas.height = img.naturalHeight;
    originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    originalCtx.drawImage(img, 0, 0);

    // initialize preview canvas to same size
    previewCanvas.width = img.naturalWidth;
    previewCanvas.height = img.naturalHeight;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.drawImage(img, 0, 0);

    showOriginalCanvas();
    showPreviewCanvas();
    updateUndoUI();
  };
  img.src = objectURL;
}

// Drop zone listeners
if (dropZone && fileInput) {
  dropZone.addEventListener("click", (e) => {
    if (e.target !== dropZone && e.target !== dropText) return;
    fileInput.click();
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) loadImage(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) loadImage(e.target.files[0]);
  });
}
