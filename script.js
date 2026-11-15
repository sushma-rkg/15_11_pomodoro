// Pomodoro timer: 30 seconds for testing (normal length is 25 minutes).
const TOTAL_MS = 30 * 1000;
const START_BLUR = 26; // pixels of blur at the start (0 at 00:00)
const BLUR_PAD = 80; // must match --pad in style.css

const timeEl = document.getElementById("time");
const labelEl = document.getElementById("label");
const ringEl = document.getElementById("ring");
const frameEl = document.getElementById("frame");
const artEl = document.getElementById("artImg");
const blurCanvas = document.getElementById("artBlur");
const nameEl = document.getElementById("paintingName");
const artistEl = document.getElementById("paintingArtist");
const yearEl = document.getElementById("paintingYear");
const linkEl = document.getElementById("paintingLink");
const startPauseBtn = document.getElementById("startPause");
const resetBtn = document.getElementById("reset");
const restartBtn = document.getElementById("restart");
const detailsEl = document.getElementById("details");

// state: "idle" (before starting), "running", "paused", "finished"
let state = "idle";
let remainingMs = TOTAL_MS; // time left while idle or paused
let endTime = 0; // real clock time when the timer ends (while running)
let intervalId = null;

// ---- Temple bell (made with the browser's built-in Web Audio, no sound files) ----
let audioCtx = null;
let activeBell = null; // the bell that is scheduled or ringing right now

function getAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null; // no sound available: the timer still works
  }
}

// partials = [frequency ratio, loudness, seconds it keeps ringing]
function templeBell(ctx, out, when, oscillators) {
  const freq = 220;
  const partials = [[0.5, 0.20, 4.2], [1, 0.30, 4.2], [1.19, 0.14, 3.4],
                    [1.5, 0.10, 2.8], [2, 0.12, 2.5], [2.74, 0.06, 1.7]];
  partials.forEach(([ratio, level, decay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(gain);
    gain.connect(out);
    osc.start(when);
    osc.stop(when + decay + 0.05);
    oscillators.push(osc);
  });
}

// Book the bell for the exact moment the timer ends. The audio clock keeps
// perfect time even when the browser slows this page down in a background tab.
function scheduleBell(delayMs) {
  cancelBell();
  const ctx = getAudio();
  if (!ctx) return;
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  const oscillators = [];
  templeBell(ctx, bus, ctx.currentTime + delayMs / 1000, oscillators);
  activeBell = { bus, oscillators };
}

// Cancel a booked bell, or quickly fade out one that is already ringing.
function cancelBell() {
  if (!activeBell) return;
  const now = audioCtx.currentTime;
  const { bus, oscillators } = activeBell;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(bus.gain.value, now);
  bus.gain.linearRampToValueAtTime(0, now + 0.05);
  oscillators.forEach((osc) => {
    try { osc.stop(now + 0.1); } catch (e) { /* already stopped */ }
  });
  activeBell = null;
}

// ---- The painting (from the Met Museum's free public API) ----
const MET_API = "https://collectionapi.metmuseum.org/public/collection/v1";
let loadCounter = 0; // so an older, slower request can never replace a newer painting

// The Met's search only lets us reach the first 10,000 results, 500 at a time.
// So we ask for one random page of 500 ID numbers and pick from it.
async function getRandomPageOfIds() {
  const offset = Math.floor(Math.random() * 20) * 500; // 0, 500, ... 9500
  const url = MET_API.replace("/v1", "/v1.1") +
    "/search?hasImages=true&medium=Paintings&q=*&limit=500&offset=" + offset;
  const res = await fetch(url);
  return (await res.json()).objectIDs || [];
}

// Only real paintings that are public domain and have an image.
// (The Met's search also returns boxes, scrolls, fans, drawings and so on,
// so we check the record's own object type too.)
function qualifies(record) {
  return Boolean(
    record &&
    record.objectName === "Painting" &&
    record.isPublicDomain === true &&
    (record.primaryImageSmall || record.primaryImage)
  );
}

async function getRecord(id) {
  try {
    const res = await fetch(MET_API + "/objects/" + id);
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

// Look at a few random paintings at once and keep one that qualifies.
// If none do, quietly try a fresh random page of results.
async function pickRandomPainting() {
  for (let round = 0; round < 6; round++) {
    const ids = await getRandomPageOfIds();
    if (ids.length === 0) continue;
    const candidates = Array.from({ length: 12 }, () => ids[Math.floor(Math.random() * ids.length)]);
    const records = await Promise.all(candidates.map(getRecord));
    const good = records.filter(qualifies);
    if (good.length > 0) return good[Math.floor(Math.random() * good.length)];
  }
  return null;
}

// Show one painting. The image and the details come from the same record.
function showPainting(record) {
  artEl.src = record.primaryImageSmall || record.primaryImage;
  nameEl.textContent = record.title || "Unknown";
  artistEl.textContent = record.artistDisplayName || "Unknown";
  yearEl.textContent = record.objectDate || "Unknown";
  linkEl.href = record.objectURL;
}

function clearPainting() {
  frameEl.classList.remove("loaded");
  artEl.removeAttribute("src");
  nameEl.textContent = "";
  artistEl.textContent = "";
  yearEl.textContent = "";
  linkEl.removeAttribute("href");
}

async function loadPainting() {
  const myLoad = ++loadCounter;
  clearPainting();
  const record = await pickRandomPainting();
  if (record && myLoad === loadCounter) showPainting(record);
}

// Draw the blurred copy: the painting plus mirrored copies of itself around
// every edge, so the blur has real picture to mix in at the edges (no fading
// to transparent, and nothing cut off).
function drawBlurCopy() {
  const w = frameEl.clientWidth;
  const h = frameEl.clientHeight;
  if (!artEl.complete || !artEl.naturalWidth || !w || !h) return;
  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  blurCanvas.width = Math.round((w + 2 * BLUR_PAD) * dpr);
  blurCanvas.height = Math.round((h + 2 * BLUR_PAD) * dpr);
  const ctx = blurCanvas.getContext("2d");
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      const x0 = BLUR_PAD + ix * w;
      const y0 = BLUR_PAD + iy * h;
      const sx = ix === 0 ? 1 : -1;
      const sy = iy === 0 ? 1 : -1;
      ctx.setTransform(dpr * sx, 0, 0, dpr * sy,
        dpr * (sx === 1 ? x0 : x0 + w), dpr * (sy === 1 ? y0 : y0 + h));
      ctx.drawImage(artEl, 0, 0, w, h);
    }
  }
}

// Only show the painting once it is loaded AND its blurred copy is ready.
artEl.addEventListener("load", () => {
  frameEl.style.setProperty("--ar", artEl.naturalWidth / artEl.naturalHeight);
  drawBlurCopy();
  frameEl.classList.add("loaded");
});

// If the screen size changes (turning a phone, resizing), redraw the copy.
new ResizeObserver(() => {
  if (frameEl.classList.contains("loaded")) drawBlurCopy();
}).observe(frameEl);

function show(ms) {
  const seconds = Math.ceil(ms / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  timeEl.textContent = mm + ":" + ss;

  const done = 1 - ms / TOTAL_MS; // 0 at start, 1 at the end
  ringEl.style.setProperty("--p", (done * 100).toFixed(2));
  frameEl.style.setProperty("--blur", (START_BLUR * (1 - done)).toFixed(2) + "px");
  frameEl.classList.toggle("sharp", ms === 0);
}

function tick() {
  // Work out the time left from the real clock, so it stays correct
  // even if the browser slows this page down in a background tab.
  remainingMs = Math.max(0, endTime - Date.now());
  show(remainingMs);
  if (remainingMs === 0) finish();
}

// Time is up: stop at 00:00, swap the buttons, show the painting details.
function finish() {
  clearInterval(intervalId);
  intervalId = null;
  remainingMs = 0;
  state = "finished";
  show(0);
  labelEl.textContent = "Session complete";
  startPauseBtn.hidden = true;
  resetBtn.hidden = true;
  restartBtn.hidden = false;
  detailsEl.hidden = false;
}

function startCounting() {
  endTime = Date.now() + remainingMs;
  clearInterval(intervalId);
  intervalId = setInterval(tick, 250);
  scheduleBell(remainingMs);
  tick();
}

startPauseBtn.addEventListener("click", () => {
  if (state === "running") {
    clearInterval(intervalId);
    intervalId = null;
    remainingMs = Math.max(0, endTime - Date.now());
    if (remainingMs === 0) {
      finish(); // time was already up: let the bell ring
      return;
    }
    cancelBell();
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

// Back to the "Before starting" look (used by Reset and Restart session).
function resetToStart() {
  clearInterval(intervalId);
  intervalId = null;
  cancelBell(); // stops a booked bell, or one that is still ringing
  state = "idle";
  remainingMs = TOTAL_MS;
  labelEl.textContent = "Ready to focus";
  startPauseBtn.textContent = "Start";
  startPauseBtn.hidden = false;
  resetBtn.hidden = false;
  restartBtn.hidden = true;
  detailsEl.hidden = true;
  show(remainingMs);
}

resetBtn.addEventListener("click", resetToStart);
restartBtn.addEventListener("click", () => {
  resetToStart();
  loadPainting(); // Restart session = a new painting
});

// When you come back to the tab, update straight away.
document.addEventListener("visibilitychange", () => {
  if (state === "running") tick();
});

show(remainingMs); // starts strongly blurred
loadPainting(); // first painting when the page opens
