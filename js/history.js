// js/history.js
// History / Undo helpers

import { previewCanvas, previewCtx, slicesContainer, undoBtn } from "./dom.js";
import { state } from "./state.js";

export function updateUndoUI() {
  undoBtn.disabled = state.historyStack.length === 0;
}

export function pushHistory() {
  if (!previewCanvas.width || !previewCanvas.height) return;
  state.historyStack.push({
    imageData: previewCtx.getImageData(
      0,
      0,
      previewCanvas.width,
      previewCanvas.height
    ),
    lastOperation: state.lastOperation,
    frames: [...state.frames],
    lastCroppedDataURL: state.lastCroppedDataURL,
    lastMetadata: state.lastMetadata ? { ...state.lastMetadata } : null,
  });
  updateUndoUI();
}

export function popHistory() {
  if (state.historyStack.length === 0) return;
  const snap = state.historyStack.pop();
  previewCanvas.width = snap.imageData.width;
  previewCanvas.height = snap.imageData.height;
  previewCtx.putImageData(snap.imageData, 0, 0);

  state.lastOperation = snap.lastOperation;
  state.frames = snap.frames;
  state.lastCroppedDataURL = snap.lastCroppedDataURL;
  state.lastMetadata = snap.lastMetadata;

  // Always restore to canvas view — slice thumbnails in DOM are stale after undo
  previewCanvas.style.display = "block";
  slicesContainer.style.display = "none";

  updateUndoUI();
}

export function clearHistory() {
  state.historyStack.length = 0;
  updateUndoUI();
}

if (undoBtn) {
  undoBtn.addEventListener("click", () => {
    popHistory();
  });
}
