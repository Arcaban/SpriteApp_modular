// js/history.js
// History / Undo helpers

import { previewCanvas, previewCtx, undoBtn } from "./dom.js";
import { state } from "./state.js";

export function updateUndoUI() {
  undoBtn.disabled = state.historyStack.length === 0;
}

export function pushHistory() {
  if (!previewCanvas.width || !previewCanvas.height) return;
  const snapshot = previewCtx.getImageData(
    0,
    0,
    previewCanvas.width,
    previewCanvas.height
  );
  state.historyStack.push(snapshot);
  updateUndoUI();
}

export function popHistory() {
  if (state.historyStack.length === 0) return;
  const data = state.historyStack.pop();
  previewCanvas.width = data.width;
  previewCanvas.height = data.height;
  previewCtx.putImageData(data, 0, 0);
  updateUndoUI();
}

export function clearHistory() {
  state.historyStack.length = 0;
  updateUndoUI();
}

// Bind Undo button
if (undoBtn) {
  undoBtn.addEventListener("click", () => {
    popHistory();
  });
}
