// Pomodoro timer: always 25 minutes.
const TOTAL_MS = 25 * 60 * 1000;
const START_BLUR = 26; // pixels of blur at 25:00, 0 at 00:00

const timeEl = document.getElementById("time");
const labelEl = document.getElementById("label");
const ringEl = document.getElementById("ring");
const artEl = document.getElementById("artImg");
const startPauseBtn = document.getElementById("startPause");
const resetBtn = document.getElementById("reset");

// state: "idle" (before starting), "running", "paused"
let state = "idle";
let remainingMs = TOTAL_MS; // time left while idle or paused
let endTime = 0; // real clock time when the timer ends (while running)
let intervalId = null;

function show(ms) {
  const seconds = Math.ceil(ms / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  timeEl.textContent = mm + ":" + ss;

  const done = 1 - ms / TOTAL_MS; // 0 at start, 1 at the end
  ringEl.style.setProperty("--p", (done * 100).toFixed(2));
  artEl.style.setProperty("--blur", (START_BLUR * (1 - done)).toFixed(2) + "px");
}

function tick() {
  // Work out the time left from the real clock, so it stays correct
  // even if the browser slows this page down in a background tab.
  remainingMs = Math.max(0, endTime - Date.now());
  show(remainingMs);
  if (remainingMs === 0) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startCounting() {
  endTime = Date.now() + remainingMs;
  clearInterval(intervalId);
  intervalId = setInterval(tick, 250);
  tick();
}

startPauseBtn.addEventListener("click", () => {
  if (state === "running") {
    clearInterval(intervalId);
    intervalId = null;
    remainingMs = Math.max(0, endTime - Date.now());
    show(remainingMs);
    state = "paused";
    startPauseBtn.textContent = "Resume";
  } else {
    // from "idle" (Start) or "paused" (Resume)
    state = "running";
    labelEl.textContent = "Focusing";
    startPauseBtn.textContent = "Pause";
    startCounting();
  }
});

resetBtn.addEventListener("click", () => {
  clearInterval(intervalId);
  intervalId = null;
  state = "idle";
  remainingMs = TOTAL_MS;
  labelEl.textContent = "Ready to focus";
  startPauseBtn.textContent = "Start";
  show(remainingMs);
});

// When you come back to the tab, update straight away.
document.addEventListener("visibilitychange", () => {
  if (state === "running") tick();
});
