// js/slicing.js
// Slicing & detection: auto-slice + manual modes

import {
  previewCanvas,
  previewCtx,
  previewContainer,
  slicesContainer,
  overlayCanvas,
  overlayCtx,
  slicePanel,
  modeByTileBtn,
  modeByGridBtn,
  modeAutoDetectBtn,
  sliceByTileEl,
  sliceByGridEl,
  tileWidthInput,
  tileHeightInput,
  tilePaddingInput,
  gridColsInput,
  gridRowsInput,
  gridPaddingInput,
  previewSizeEl,
  applyTileSliceBtn,
  applyGridSliceBtn,
  cancelSliceBtn,
  cancelSliceBtn2,
  sliceBtn,
} from "./dom.js";
import { state, DEFAULT_TOLERANCE, OVERLAY_SHOW_MS } from "./state.js";
import { pushHistory } from "./history.js";
import {
  ensurePreviewReady,
  computeContentBBox,
  showSlicesPreview,
} from "./ui.js";

// --- Auto-slice based on components, grid detection & fallback ---

export async function performAutoSlice() {
  if (!ensurePreviewReady()) return alert("Load an image first.");
  pushHistory();

  // Small auto-clean pass: detect "fake opaque background" (opaque px close to top-left)
  (function autoCleanBackground() {
    const w = previewCanvas.width;
    const h = previewCanvas.height;
    const imgData = previewCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    let bgCount = 0;

    // count near-equal opaque pixels
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (
        a > 240 &&
        Math.abs(r - bgR) < 12 &&
        Math.abs(g - bgG) < 12 &&
        Math.abs(b - bgB) < 12
      ) {
        bgCount++;
      }
    }

    // if significant fraction of image looks "fake opaque bg", convert those to alpha=0
    if (bgCount > w * h * 0.18) {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (
          a > 240 &&
          Math.abs(r - bgR) < 12 &&
          Math.abs(g - bgG) < 12 &&
          Math.abs(b - bgB) < 12
        ) {
          data[i + 3] = 0;
        }
      }
      previewCtx.putImageData(imgData, 0, 0);
    }
  })();

  const padding = 2;
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  const imgData = previewCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // background ref (transparent / top-left pixel fallback)
  const bgRef =
    state.originalBgColor || { r: data[0], g: data[1], b: data[2] };

  function isContentAt(idx) {
    const a = data[idx + 3];
    if (a > 16) return true;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return (
      Math.abs(r - bgRef.r) > DEFAULT_TOLERANCE ||
      Math.abs(g - bgRef.g) > DEFAULT_TOLERANCE ||
      Math.abs(b - bgRef.b) > DEFAULT_TOLERANCE
    );
  }

  // ---------- Build binary mask ----------
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      const pos = base + x;
      const i = pos * 4;
      mask[pos] = isContentAt(i) ? 1 : 0;
    }
  }

  // ---------- Connected components ----------
  const labels = new Int32Array(w * h); // 0 = unlabeled
  const comps = []; // {minX,minY,maxX,maxY,area}
  let label = 0;
  const stack = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pos = y * w + x;
      if (!mask[pos] || labels[pos]) continue;
      label++;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      stack.push(pos);
      labels[pos] = label;
      while (stack.length) {
        const p = stack.pop();
        const px = p % w;
        const py = Math.floor(p / w);
        area++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        // neighbors 4-connected
        if (px > 0) {
          const q = p - 1;
          if (!labels[q] && mask[q]) {
            labels[q] = label;
            stack.push(q);
          }
        }
        if (px < w - 1) {
          const q = p + 1;
          if (!labels[q] && mask[q]) {
            labels[q] = label;
            stack.push(q);
          }
        }
        if (py > 0) {
          const q = p - w;
          if (!labels[q] && mask[q]) {
            labels[q] = label;
            stack.push(q);
          }
        }
        if (py < h - 1) {
          const q = p + w;
          if (!labels[q] && mask[q]) {
            labels[q] = label;
            stack.push(q);
          }
        }
      }
      comps.push({ minX, minY, maxX, maxY, area });
    }
  }

  // ---------- Filter components by size (median-based) ----------
  if (comps.length > 0) {
    const areas = comps.map((c) => c.area).sort((a, b) => a - b);
    const medianArea = areas[Math.floor(areas.length / 2)] || areas[0];
    const minArea = Math.max(8, Math.round(medianArea * 0.2));
    const candidates = comps.filter((c) => c.area >= minArea);
    const compCandidates = candidates.length
      ? candidates
      : comps.filter((c) => c.area >= 6);

    if (compCandidates.length >= 2) {
      compCandidates.sort((a, b) => a.minY - b.minY || a.minX - b.minX);

      // show overlay for user feedback (client-scaled)
      if (overlayCtx && overlayCanvas && previewContainer) {
        const previewRect = previewCanvas.getBoundingClientRect();
        const containerRect = previewContainer.getBoundingClientRect();
        const cssW = Math.max(1, Math.round(previewRect.width));
        const cssH = Math.max(1, Math.round(previewRect.height));
        overlayCanvas.style.left =
          Math.round(previewRect.left - containerRect.left) + "px";
        overlayCanvas.style.top =
          Math.round(previewRect.top - containerRect.top) + "px";
        overlayCanvas.style.width = cssW + "px";
        overlayCanvas.style.height = cssH + "px";
        overlayCanvas.width = cssW;
        overlayCanvas.height = cssH;
        overlayCanvas.style.display = "block";
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        const scaleX = overlayCanvas.width / Math.max(1, previewCanvas.width);
        const scaleY = overlayCanvas.height / Math.max(1, previewCanvas.height);
        overlayCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        overlayCtx.strokeStyle = "rgba(37,99,235,0.95)";
        overlayCtx.lineWidth = 2 / Math.max(scaleX, scaleY);
        for (const c of compCandidates) {
          overlayCtx.strokeRect(
            c.minX - 1,
            c.minY - 1,
            c.maxX - c.minX + 1 + 2,
            c.maxY - c.minY + 1 + 2
          );
        }
        await new Promise((r) => setTimeout(r, OVERLAY_SHOW_MS));
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        overlayCanvas.style.display = "none";
        overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
      }

      // build slices (apply padding, clamp)
      slicesContainer.innerHTML = "";
      state.frames = [];
      for (const c of compCandidates) {
        const sx = Math.max(0, c.minX - padding);
        const sy = Math.max(0, c.minY - padding);
        const sw = Math.min(
          w - sx,
          c.maxX - c.minX + 1 + padding * 2
        );
        const sh = Math.min(
          h - sy,
          c.maxY - c.minY + 1 + padding * 2
        );

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = sw;
        sliceCanvas.height = sh;
        const sliceCtx = sliceCanvas.getContext("2d");
        sliceCtx.drawImage(
          previewCanvas,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          sw,
          sh
        );

        const container = document.createElement("div");
        container.className = "slice-item";
        container.appendChild(sliceCanvas);
        slicesContainer.appendChild(container);

        state.frames.push({
          x: sx,
          y: sy,
          w: sw,
          h: sh,
          dataURL: sliceCanvas.toDataURL("image/png"),
        });
      }

      state.lastOperation = "sliced";
      showSlicesPreview();
      return;
    }
  }

  // ---------- GRID DETECTION (existing heuristic) ----------
  function detectGridFromMask(maskArr, imgW, imgH) {
    const colSums = new Uint32Array(imgW);
    const rowSums = new Uint32Array(imgH);
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const v = maskArr[y * imgW + x];
        if (v) {
          colSums[x]++;
          rowSums[y]++;
        }
      }
    }
    const maxCol = Math.max(...colSums);
    const maxRow = Math.max(...rowSums);

    const colEmptyThresh = Math.max(1, Math.round(maxCol * 0.08));
    const rowEmptyThresh = Math.max(1, Math.round(maxRow * 0.08));

    const emptyCols = [];
    for (let x = 0; x < imgW; x++) {
      if (colSums[x] <= colEmptyThresh) emptyCols.push(x);
    }
    const emptyRows = [];
    for (let y = 0; y < imgH; y++) {
      if (rowSums[y] <= rowEmptyThresh) emptyRows.push(y);
    }

    function clusterCenters(indices) {
      if (indices.length === 0) return [];
      const centers = [];
      let start = indices[0];
      let last = indices[0];
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] - last > 2) {
          centers.push(Math.round((start + last) / 2));
          start = indices[i];
        }
        last = indices[i];
      }
      centers.push(Math.round((start + last) / 2));
      return centers;
    }

    const colCenters = clusterCenters(emptyCols);
    const rowCenters = clusterCenters(emptyRows);

    function inferTileSize(centers, fullSize) {
      if (centers.length < 2) return null;
      const diffs = [];
      for (let i = 1; i < centers.length; i++)
        diffs.push(Math.abs(centers[i] - centers[i - 1]));
      diffs.sort((a, b) => a - b);
      const median = diffs[Math.floor(diffs.length / 2)] || diffs[0];
      const tile = Math.max(1, Math.round(median));
      const count = Math.round(fullSize / tile);
      return { tile, count };
    }

    const inferredX = inferTileSize(colCenters, imgW);
    const inferredY = inferTileSize(rowCenters, imgH);

    return {
      inferredX,
      inferredY,
      colCenters,
      rowCenters,
      colSums,
      rowSums,
    };
  }

  const gridInfo = detectGridFromMask(mask, w, h);

  function validateAndSliceGrid(tileW, tileH) {
    const cols = Math.max(1, Math.floor(w / tileW));
    const rows = Math.max(1, Math.floor(h / tileH));
    if (cols < 2 || rows < 2) return false;

    let positive = 0;
    let total = 0;
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        const sx = Math.min(w - 1, Math.floor(cx * tileW + tileW / 2));
        const sy = Math.min(h - 1, Math.floor(ry * tileH + tileH / 2));
        const i = (sy * w + sx) * 4;
        total++;
        if (isContentAt(i)) positive++;
      }
    }
    if (positive / total < 0.35) return false;

    slicesContainer.innerHTML = "";
    state.frames = [];
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        const sx = cx * tileW;
        const sy = ry * tileH;
        const sw = Math.min(tileW, w - sx);
        const sh = Math.min(tileH, h - sy);
        let has = false;
        const stepX = Math.max(1, Math.floor(sw / 3));
        const stepY = Math.max(1, Math.floor(sh / 3));
        for (let yy = sy; yy < sy + sh && !has; yy += stepY) {
          for (let xx = sx; xx < sx + sw && !has; xx += stepX) {
            const ii = (yy * w + xx) * 4;
            if (isContentAt(ii)) has = true;
          }
        }
        if (!has) continue;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = sw;
        sliceCanvas.height = sh;
        const sliceCtx = sliceCanvas.getContext("2d");
        sliceCtx.drawImage(
          previewCanvas,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          sw,
          sh
        );
        const container = document.createElement("div");
        container.className = "slice-item";
        container.appendChild(sliceCanvas);
        slicesContainer.appendChild(container);
        state.frames.push({
          x: sx,
          y: sy,
          w: sw,
          h: sh,
          dataURL: sliceCanvas.toDataURL("image/png"),
        });
      }
    }
    state.lastOperation = "sliced";
    showSlicesPreview();
    return true;
  }

  if (gridInfo && (gridInfo.inferredX || gridInfo.inferredY)) {
    if (gridInfo.inferredX && gridInfo.inferredY) {
      const tileW = gridInfo.inferredX.tile;
      const tileH = gridInfo.inferredY.tile;
      let ok = validateAndSliceGrid(tileW, tileH);
      if (!ok) {
        for (let dw = -2; dw <= 2 && !ok; dw++) {
          for (let dh = -2; dh <= 2 && !ok; dh++) {
            if (dw === 0 && dh === 0) continue;
            ok = validateAndSliceGrid(
              Math.max(1, tileW + dw),
              Math.max(1, tileH + dh)
            );
          }
        }
      }
      if (ok) return;
    } else if (gridInfo.inferredX) {
      const tileW = gridInfo.inferredX.tile;
      for (let possibleRows = 2; possibleRows <= 12; possibleRows++) {
        const tileH = Math.round(h / possibleRows);
        if (validateAndSliceGrid(tileW, tileH)) return;
      }
    } else if (gridInfo.inferredY) {
      const tileH = gridInfo.inferredY.tile;
      for (let possibleCols = 2; possibleCols <= 12; possibleCols++) {
        const tileW = Math.round(w / possibleCols);
        if (validateAndSliceGrid(tileW, tileH)) return;
      }
    }
  }

  // ---------- Fallback: normalized tile sweep (grid guess) ----------
  const candidateTileSizes = [];
  const maxBase = Math.floor(Math.min(w, h) / 2);
  let t = maxBase;
  while (t >= 16) {
    if (!candidateTileSizes.includes(t)) candidateTileSizes.push(t);
    t = Math.floor(t * 0.75);
  }

  let best = {
    ratio: 0,
    tile: null,
    cols: 0,
    rows: 0,
  };

  for (const tile of candidateTileSizes) {
    const cols = Math.floor(w / tile);
    const rows = Math.floor(h / tile);
    if (cols < 2 || rows < 2) continue;

    let positive = 0;
    const total = cols * rows;

    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        const sx = Math.min(w - 1, Math.floor(cx * tile + tile / 2));
        const sy = Math.min(h - 1, Math.floor(ry * tile + tile / 2));
        const i = (sy * w + sx) * 4;
        if (isContentAt(i)) positive++;
      }
    }

    const ratio = positive / total;

    if (
      ratio > best.ratio + 0.02 ||
      (Math.abs(ratio - best.ratio) <= 0.02 && tile > (best.tile || 0))
    ) {
      best = { ratio, tile, cols, rows };
    }
  }

  if (best.tile && best.ratio > 0) {
    slicesContainer.innerHTML = "";
    state.frames = [];
    for (let ry = 0; ry < best.rows; ry++) {
      for (let cx = 0; cx < best.cols; cx++) {
        const sx = cx * best.tile;
        const sy = ry * best.tile;
        const sw = Math.min(best.tile, w - sx);
        const sh = Math.min(best.tile, h - sy);
        let has = false;
        const stepX = Math.max(1, Math.floor(sw / 3));
        const stepY = Math.max(1, Math.floor(sh / 3));
        for (let yy = sy; yy < sy + sh && !has; yy += stepY) {
          for (let xx = sx; xx < sx + sw && !has; xx += stepX) {
            const ii = (yy * w + xx) * 4;
            if (isContentAt(ii)) has = true;
          }
        }
        if (!has) continue;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = sw;
        sliceCanvas.height = sh;
        const sliceCtx = sliceCanvas.getContext("2d");
        sliceCtx.drawImage(
          previewCanvas,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          sw,
          sh
        );
        const container = document.createElement("div");
        container.className = "slice-item";
        container.appendChild(sliceCanvas);
        slicesContainer.appendChild(container);
        state.frames.push({
          x: sx,
          y: sy,
          w: sw,
          h: sh,
          dataURL: sliceCanvas.toDataURL("image/png"),
        });
      }
    }
    state.lastOperation = "sliced";
    showSlicesPreview();
    return;
  }

  alert(
    "Could not auto-detect sprites. Try manual slice or adjust the image (remove background/crop)."
  );
}

// --- Slice panel controls (open panel, manual grid, etc.) ---

export function openSlicePanel() {
  if (!ensurePreviewReady()) return alert("Load an image first.");
  if (!slicePanel) return;
  slicePanel.style.display = "block";
  slicePanel.setAttribute("aria-hidden", "false");
  if (previewSizeEl)
    previewSizeEl.textContent = `${previewCanvas.width}×${previewCanvas.height}px`;
  if (state.lastGridCols > 0 && state.lastGridRows > 0) {
    gridColsInput.value = state.lastGridCols;
    gridRowsInput.value = state.lastGridRows;
    const bbox = computeContentBBox();
    if (bbox) {
      tileWidthInput.value = Math.max(
        1,
        Math.floor(bbox.width / state.lastGridCols)
      );
      tileHeightInput.value = Math.max(
        1,
        Math.floor(bbox.height / state.lastGridRows)
      );
    } else {
      tileWidthInput.value = Math.max(
        1,
        Math.floor(previewCanvas.width / state.lastGridCols)
      );
      tileHeightInput.value = Math.max(
        1,
        Math.floor(previewCanvas.height / state.lastGridRows)
      );
    }
  } else if (state.frames && state.frames.length > 0) {
    const ws = state.frames.map((f) => f.w).sort((a, b) => a - b);
    const hs = state.frames.map((f) => f.h).sort((a, b) => a - b);
    const mw =
      ws[Math.floor(ws.length / 2)] || Math.floor(previewCanvas.width / 5);
    const mh =
      hs[Math.floor(hs.length / 2)] || Math.floor(previewCanvas.height / 5);
    tileWidthInput.value = mw;
    tileHeightInput.value = mh;
  } else {
    tileWidthInput.value = Math.max(
      1,
      Math.floor(previewCanvas.width / 5)
    );
    tileHeightInput.value = Math.max(
      1,
      Math.floor(previewCanvas.height / 5)
    );
  }
}

export function closeSlicePanel() {
  if (!slicePanel) return;
  slicePanel.style.display = "none";
  slicePanel.setAttribute("aria-hidden", "true");
  if (overlayCanvas && overlayCtx) {
    overlayCanvas.style.display = "none";
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }
}

// ensure slice panel floats to the right of preview (PATCH A)
(function enhanceSlicePanelLayout() {
  if (!slicePanel || !previewContainer) return;
  slicePanel.style.position = "fixed";
  slicePanel.style.right = "20px";
  slicePanel.style.top = "120px";
  slicePanel.style.width = "260px";
  slicePanel.style.zIndex = "999";

  previewContainer.style.maxWidth = "900px";
})();

// --- Live grid overlay helpers ---

function drawGridOverlay(
  tileW,
  tileH,
  pad,
  originX = 0,
  originY = 0,
  colsCount = null,
  rowsCount = null
) {
  if (!overlayCanvas || !overlayCtx || !ensurePreviewReady()) return;
  const previewRect = previewCanvas.getBoundingClientRect();
  const containerRect = previewContainer.getBoundingClientRect();
  const left = Math.round(previewRect.left - containerRect.left);
  const top = Math.round(previewRect.top - containerRect.top);
  const cssW = Math.round(previewRect.width);
  const cssH = Math.round(previewRect.height);
  if (cssW <= 0 || cssH <= 0) return;

  overlayCanvas.style.left = left + "px";
  overlayCanvas.style.top = top + "px";
  overlayCanvas.style.width = cssW + "px";
  overlayCanvas.style.height = cssH + "px";
  overlayCanvas.style.display = "block";

  overlayCanvas.width = cssW;
  overlayCanvas.height = cssH;
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  const w = previewCanvas.width;
  const h = previewCanvas.height;
  const scaleX = overlayCanvas.width / w;
  const scaleY = overlayCanvas.height / h;
  overlayCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  let ccount =
    colsCount || Math.max(1, Math.floor((w - originX) / tileW));
  let rcount =
    rowsCount || Math.max(1, Math.floor((h - originY) / tileH));

  overlayCtx.strokeStyle = "rgba(0,0,0,0.6)";
  overlayCtx.lineWidth = 1;
  overlayCtx.setLineDash([]);

  for (let y = 0; y < rcount; y++) {
    for (let x = 0; x < ccount; x++) {
      const sx = originX + x * tileW;
      const sy = originY + y * tileH;
      const sw = Math.min(tileW, w - sx);
      const sh = Math.min(tileH, h - sy);
      if (sw <= 0 || sh <= 0) continue;
      overlayCtx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      if (pad && pad > 0) {
        const ix = sx + pad;
        const iy = sy + pad;
        const iw = Math.max(0, sw - pad * 2);
        const ih = Math.max(0, sh - pad * 2);
        overlayCtx.strokeStyle = "rgba(255,0,0,0.6)";
        overlayCtx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
        overlayCtx.strokeStyle = "rgba(0,0,0,0.6)";
      }
    }
  }
}

function updatePreviewGrid() {
  if (!slicePanel || slicePanel.style.display === "none") return;
  const byTile = modeByTileBtn && modeByTileBtn.classList.contains("active");
  const byGrid = modeByGridBtn && modeByGridBtn.classList.contains("active");
  if (!ensurePreviewReady()) return;

  if (byTile) {
    const tileW = Math.max(
      1,
      parseInt(tileWidthInput.value, 10) || 32
    );
    const tileH = Math.max(
      1,
      parseInt(tileHeightInput.value, 10) || 32
    );
    const pad = Math.max(
      0,
      parseInt((tilePaddingInput && tilePaddingInput.value) || 0, 10)
    );
    const bbox = computeContentBBox();
    const originX = bbox ? bbox.minX : 0;
    const originY = bbox ? bbox.minY : 0;
    drawGridOverlay(tileW, tileH, pad, originX, originY);
  } else if (byGrid) {
    const cols = Math.max(
      1,
      parseInt(gridColsInput.value, 10) || 1
    );
    const rows = Math.max(
      1,
      parseInt(gridRowsInput.value, 10) || 1
    );
    const pad = Math.max(
      0,
      parseInt((gridPaddingInput && gridPaddingInput.value) || 0, 10)
    );
    const tileW = Math.max(1, Math.floor(previewCanvas.width / cols));
    const tileH = Math.max(1, Math.floor(previewCanvas.height / rows));
    drawGridOverlay(tileW, tileH, pad, 0, 0, cols, rows);
  }
}

// Bind live preview inputs
if (tileWidthInput)
  tileWidthInput.addEventListener("input", updatePreviewGrid);
if (tileHeightInput)
  tileHeightInput.addEventListener("input", updatePreviewGrid);
if (tilePaddingInput)
  tilePaddingInput.addEventListener("input", updatePreviewGrid);
if (gridColsInput)
  gridColsInput.addEventListener("input", updatePreviewGrid);
if (gridRowsInput)
  gridRowsInput.addEventListener("input", updatePreviewGrid);
if (gridPaddingInput)
  gridPaddingInput.addEventListener("input", updatePreviewGrid);
if (modeByTileBtn)
  modeByTileBtn.addEventListener("click", updatePreviewGrid);
if (modeByGridBtn)
  modeByGridBtn.addEventListener("click", updatePreviewGrid);

// Wire slice panel buttons
if (modeByTileBtn && modeByGridBtn && sliceByTileEl && sliceByGridEl) {
  modeByTileBtn.addEventListener("click", () => {
    modeByTileBtn.classList.add("active");
    modeByGridBtn.classList.remove("active");
    sliceByTileEl.style.display = "block";
    sliceByGridEl.style.display = "none";

    if (previewCanvas.width && previewCanvas.height) {
      if (state.lastGridCols > 0 && state.lastGridRows > 0) {
        const bbox = computeContentBBox();
        if (bbox) {
          tileWidthInput.value = Math.max(
            1,
            Math.floor(bbox.width / state.lastGridCols)
          );
          tileHeightInput.value = Math.max(
            1,
            Math.floor(bbox.height / state.lastGridRows)
          );
        } else {
          tileWidthInput.value = Math.max(
            1,
            Math.floor(previewCanvas.width / state.lastGridCols)
          );
          tileHeightInput.value = Math.max(
            1,
            Math.floor(previewCanvas.height / state.lastGridRows)
          );
        }
      } else if (state.frames && state.frames.length > 0) {
        const ws = state.frames.map((f) => f.w).sort((a, b) => a - b);
        const hs = state.frames.map((f) => f.h).sort((a, b) => a - b);
        tileWidthInput.value =
          ws[Math.floor(ws.length / 2)] ||
          Math.max(1, Math.floor(previewCanvas.width / 5));
        tileHeightInput.value =
          hs[Math.floor(hs.length / 2)] ||
          Math.max(1, Math.floor(previewCanvas.height / 5));
      }
    }
  });

  modeByGridBtn.addEventListener("click", () => {
    modeByGridBtn.classList.add("active");
    modeByTileBtn.classList.remove("active");
    sliceByGridEl.style.display = "block";
    sliceByTileEl.style.display = "none";
  });
}

if (modeAutoDetectBtn) {
  modeAutoDetectBtn.addEventListener("click", async () => {
    closeSlicePanel();
    await performAutoSlice();
  });
}

if (applyTileSliceBtn) {
  applyTileSliceBtn.addEventListener("click", () => {
    const tileW = Math.max(
      1,
      parseInt(tileWidthInput.value, 10) || 32
    );
    const tileH = Math.max(
      1,
      parseInt(tileHeightInput.value, 10) || 32
    );
    closeSlicePanel();
    performManualTileSlice(tileW, tileH);
  });
}

if (applyGridSliceBtn) {
  applyGridSliceBtn.addEventListener("click", () => {
    const cols = Math.max(1, parseInt(gridColsInput.value, 10) || 1);
    const rows = Math.max(1, parseInt(gridRowsInput.value, 10) || 1);
    closeSlicePanel();
    performRowsColsSlice(cols, rows);
  });
}

if (cancelSliceBtn) cancelSliceBtn.addEventListener("click", closeSlicePanel);
if (cancelSliceBtn2) cancelSliceBtn2.addEventListener("click", closeSlicePanel);

if (sliceBtn) {
  sliceBtn.addEventListener("click", () => openSlicePanel());
}

// Manual tile slicing
export async function performManualTileSlice(tileW, tileH) {
  if (!ensurePreviewReady()) return alert("Load an image first.");
  pushHistory();
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  const imgData = previewCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const bgRef =
    state.originalBgColor || { r: data[0], g: data[1], b: data[2] };
  const tolerance = DEFAULT_TOLERANCE;

  function isContentAt(i) {
    const a = data[i + 3];
    if (a > 16) return true;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return (
      Math.abs(r - bgRef.r) > tolerance ||
      Math.abs(g - bgRef.g) > tolerance ||
      Math.abs(b - bgRef.b) > tolerance
    );
  }

  const cols = [];
  const rows = [];
  const ccount = Math.max(1, Math.floor(w / tileW));
  const rcount = Math.max(1, Math.floor(h / tileH));
  for (let x = 0; x < ccount; x++)
    cols.push({ start: x * tileW, width: tileW });
  for (let y = 0; y < rcount; y++)
    rows.push({ start: y * tileH, height: tileH });

  slicesContainer.innerHTML = "";
  state.frames = [];
  for (let ry = 0; ry < rows.length; ry++) {
    for (let cx = 0; cx < cols.length; cx++) {
      const sx = cols[cx].start;
      const sy = rows[ry].start;
      const sw = Math.min(cols[cx].width, w - sx);
      const sh = Math.min(rows[ry].height, h - sy);
      if (sw <= 0 || sh <= 0) continue;
      const stepX = Math.max(1, Math.floor(sw / 3));
      const stepY = Math.max(1, Math.floor(sh / 3));
      let has = false;
      for (let yy = sy; yy < sy + sh && !has; yy += stepY)
        for (let xx = sx; xx < sx + sw && !has; xx += stepX) {
          const ii = (yy * w + xx) * 4;
          if (isContentAt(ii)) has = true;
        }
      if (!has) continue;
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = sw;
      sliceCanvas.height = sh;
      const sliceCtx = sliceCanvas.getContext("2d");
      sliceCtx.drawImage(
        previewCanvas,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        sw,
        sh
      );
      const container = document.createElement("div");
      container.className = "slice-item";
      container.appendChild(sliceCanvas);
      slicesContainer.appendChild(container);
      state.frames.push({
        x: sx,
        y: sy,
        w: sw,
        h: sh,
        dataURL: sliceCanvas.toDataURL("image/png"),
      });
    }
  }
  state.lastOperation = "sliced";
  showSlicesPreview();
}

export async function performRowsColsSlice(colsCount, rowsCount) {
  if (!ensurePreviewReady()) return alert("Load an image first.");
  pushHistory();
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  const imgData = previewCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const bgRef =
    state.originalBgColor || { r: data[0], g: data[1], b: data[2] };
  const tolerance = DEFAULT_TOLERANCE;

  function isContentAt(i) {
    const a = data[i + 3];
    if (a > 16) return true;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return (
      Math.abs(r - bgRef.r) > tolerance ||
      Math.abs(g - bgRef.g) > tolerance ||
      Math.abs(b - bgRef.b) > tolerance
    );
  }

  const tileW = Math.max(1, Math.floor(w / colsCount));
  const tileH = Math.max(1, Math.floor(h / rowsCount));
  const cols = [];
  const rows = [];
  state.lastGridCols = colsCount;
  state.lastGridRows = rowsCount;
  for (let x = 0; x < colsCount; x++)
    cols.push({ start: x * tileW, width: tileW });
  for (let y = 0; y < rowsCount; y++)
    rows.push({ start: y * tileH, height: tileH });

  slicesContainer.innerHTML = "";
  state.frames = [];
  for (let ry = 0; ry < rows.length; ry++) {
    for (let cx = 0; cx < cols.length; cx++) {
      const sx = cols[cx].start;
      const sy = rows[ry].start;
      const sw = Math.min(cols[cx].width, w - sx);
      const sh = Math.min(rows[ry].height, h - sy);
      if (sw <= 0 || sh <= 0) continue;
      const stepX = Math.max(1, Math.floor(sw / 3));
      const stepY = Math.max(1, Math.floor(sh / 3));
      let has = false;
      for (let yy = sy; yy < sy + sh && !has; yy += stepY)
        for (let xx = sx; xx < sx + sw && !has; xx += stepX) {
          const ii = (yy * w + xx) * 4;
          if (isContentAt(ii)) has = true;
        }
      if (!has) continue;
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = sw;
      sliceCanvas.height = sh;
      const sliceCtx = sliceCanvas.getContext("2d");
      sliceCtx.drawImage(
        previewCanvas,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        sw,
        sh
      );
      const container = document.createElement("div");
      container.className = "slice-item";
      container.appendChild(sliceCanvas);
      slicesContainer.appendChild(container);
      state.frames.push({
        x: sx,
        y: sy,
        w: sw,
        h: sh,
        dataURL: sliceCanvas.toDataURL("image/png"),
      });
    }
  }
  state.lastOperation = "sliced";
  showSlicesPreview();
}
