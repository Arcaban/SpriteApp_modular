// js/state.js
// Central app state + shared constants

export const DEFAULT_TOLERANCE = 12;
export const OVERLAY_SHOW_MS = 850; // overlay display ms

export const state = {
  historyStack: [],
  originalBgColor: null,
  lastCroppedDataURL: null,
  lastMetadata: null,
  frames: [],
  currentFileName: "sprite",
  lastOperation: null, // 'background-removed' | 'cropped' | 'sliced'
  lastGridCols: 0,
  lastGridRows: 0,
  currentMode: "single",
};
