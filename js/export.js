// js/export.js
// Export / Download ZIP

import { downloadBtn, previewCanvas } from "./dom.js";
import { state } from "./state.js";

if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    if (state.lastOperation === "cropped") {
      if (!state.lastCroppedDataURL) {
        alert("Please crop an image first.");
        return;
      }
      const blob = await (await fetch(state.lastCroppedDataURL)).blob();
      const zip = new JSZip();
      zip.file(`${state.currentFileName}_cropped.png`, blob);
      zip.file(
        `${state.currentFileName}_metadata.json`,
        JSON.stringify(state.lastMetadata, null, 2)
      );
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${state.currentFileName}_sprites.zip`;
      a.click();
    } else if (state.lastOperation === "sliced" && state.frames.length > 0) {
      const zip = new JSZip();
      for (let i = 0; i < state.frames.length; i++) {
        const blob = await (await fetch(state.frames[i].dataURL)).blob();
        zip.file(
          `${state.currentFileName}_slice_${String(i).padStart(2, "0")}.png`,
          blob
        );
      }
      zip.file(
        `${state.currentFileName}_slices_metadata.json`,
        JSON.stringify(
          {
            originalWidth: previewCanvas.width,
            originalHeight: previewCanvas.height,
            frames: state.frames.map((f, i) => ({
              index: i,
              x: f.x,
              y: f.y,
              w: f.w,
              h: f.h,
            })),
          },
          null,
          2
        )
      );

      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${state.currentFileName}_slices.zip`;
      a.click();
    } else {
      alert("Please perform an operation (Crop or Slice) before exporting.");
    }
  });
}
