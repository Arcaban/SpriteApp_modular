// js/animator.js
// In-browser animation preview for sliced frames

import { state } from "./state.js";

let animFrameId = null;
let currentFrame = 0;
let lastTimestamp = 0;
let isPlaying = false;
let fps = 12;
let loadedImages = [];

const animPlayer = document.getElementById("anim-player");
const animCanvas = document.getElementById("anim-canvas");
const animCtx = animCanvas ? animCanvas.getContext("2d") : null;
const animPlayBtn = document.getElementById("animPlayBtn");
const animPrevBtn = document.getElementById("animPrevBtn");
const animNextBtn = document.getElementById("animNextBtn");
const animFpsInput = document.getElementById("animFpsInput");
const animFpsDisplay = document.getElementById("animFpsDisplay");
const animFrameCounter = document.getElementById("animFrameCounter");

function renderFrame(index) {
  if (!loadedImages.length || !animCtx || !animCanvas) return;
  const img = loadedImages[index];
  if (!img) return;
  animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
  animCtx.drawImage(img, 0, 0);
  if (animFrameCounter)
    animFrameCounter.textContent = `Frame ${index + 1} / ${loadedImages.length}`;
}

function tick(timestamp) {
  if (!isPlaying) return;
  if (timestamp - lastTimestamp >= 1000 / fps) {
    currentFrame = (currentFrame + 1) % loadedImages.length;
    renderFrame(currentFrame);
    lastTimestamp = timestamp;
  }
  animFrameId = requestAnimationFrame(tick);
}

function play() {
  if (!loadedImages.length) return;
  isPlaying = true;
  if (animPlayBtn) animPlayBtn.innerHTML = "&#9646;&#9646; Pause";
  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(tick);
}

function pause() {
  isPlaying = false;
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  if (animPlayBtn) animPlayBtn.innerHTML = "&#9654; Play";
}

export function startAnimation(frames) {
  if (!animPlayer || !animCtx || !animCanvas) return;
  pause();
  loadedImages = [];
  currentFrame = 0;
  if (!frames || frames.length === 0) { hideAnimator(); return; }

  animCanvas.width = frames[0].w;
  animCanvas.height = frames[0].h;
  if (animFrameCounter) animFrameCounter.textContent = `Frame 1 / ${frames.length}`;
  showAnimator();

  let loadedCount = 0;
  loadedImages = new Array(frames.length).fill(null);
  frames.forEach((f, i) => {
    const img = new Image();
    img.onload = () => {
      loadedImages[i] = img;
      loadedCount++;
      if (i === 0) renderFrame(0);
      if (loadedCount === frames.length && frames.length > 1) play();
    };
    img.src = f.dataURL;
  });
}

export function stopAnimation() {
  pause();
  loadedImages = [];
  hideAnimator();
}

function showAnimator() {
  if (animPlayer) animPlayer.style.display = "flex";
}

function hideAnimator() {
  if (animPlayer) animPlayer.style.display = "none";
}

if (animPlayBtn) {
  animPlayBtn.addEventListener("click", () => {
    if (isPlaying) pause(); else play();
  });
}

if (animPrevBtn) {
  animPrevBtn.addEventListener("click", () => {
    if (!loadedImages.length) return;
    pause();
    currentFrame = (currentFrame - 1 + loadedImages.length) % loadedImages.length;
    renderFrame(currentFrame);
  });
}

if (animNextBtn) {
  animNextBtn.addEventListener("click", () => {
    if (!loadedImages.length) return;
    pause();
    currentFrame = (currentFrame + 1) % loadedImages.length;
    renderFrame(currentFrame);
  });
}

if (animFpsInput) {
  animFpsInput.addEventListener("input", () => {
    fps = Math.max(1, parseInt(animFpsInput.value, 10) || 12);
    if (animFpsDisplay) animFpsDisplay.textContent = fps;
  });
}
