// js/dom.js
// Query all DOM elements in one place

export const dropZone = document.getElementById("drop-zone");
export const fileInput = document.getElementById("file-input");
export const originalCanvas = document.getElementById("original-canvas");
export const originalCtx = originalCanvas.getContext("2d");
export const previewCanvas = document.getElementById("preview-canvas");
export const previewCtx = previewCanvas.getContext("2d");
export const dropText = document.getElementById("drop-text");

export const bgBtn = document.getElementById("bgBtn");
export const cleanBtn = document.getElementById("cleanBtn");
export const cropBtn = document.getElementById("cropBtn");
export const sliceBtn = document.getElementById("sliceBtn");
export const undoBtn = document.getElementById("undoBtn");
export const downloadBtn = document.getElementById("downloadBtn");
export const resetBtn = document.getElementById("resetBtn");

export const previewContainer = document.getElementById("preview-container");
export const slicesContainer = document.getElementById("slices-container");
export const modeSingleBtn = document.getElementById("modeSingleBtn");
export const modeSheetBtn = document.getElementById("modeSheetBtn");
export const toolSlice = document.getElementById("tool-slice");
export const toolClean = document.getElementById("tool-clean");
export const toolCrop = document.getElementById("tool-crop");

// overlay canvas for visualizing detection (optional)
export const overlayCanvas = document.getElementById("overlay-canvas");
export const overlayCtx = overlayCanvas ? overlayCanvas.getContext("2d") : null;

// Slice panel DOM
export const slicePanel = document.getElementById("slice-panel");
export const modeByTileBtn = document.getElementById("modeByTile");
export const modeByGridBtn = document.getElementById("modeByGrid");
export const modeAutoDetectBtn = document.getElementById("modeAutoDetect");
export const sliceByTileEl = document.getElementById("slice-by-tile");
export const sliceByGridEl = document.getElementById("slice-by-grid");
export const tileWidthInput = document.getElementById("tileWidth");
export const tileHeightInput = document.getElementById("tileHeight");
export const tilePaddingInput = document.getElementById("tilePadding");
export const gridColsInput = document.getElementById("gridCols");
export const gridRowsInput = document.getElementById("gridRows");
export const gridPaddingInput = document.getElementById("gridPadding");
export const previewSizeEl = document.getElementById("previewSize");
export const applyTileSliceBtn = document.getElementById("applyTileSlice");
export const applyGridSliceBtn = document.getElementById("applyGridSlice");
export const cancelSliceBtn = document.getElementById("cancelSlice");
export const cancelSliceBtn2 = document.getElementById("cancelSlice2");
