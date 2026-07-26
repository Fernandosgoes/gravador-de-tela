# Toolbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current bare-bones toolbar UI (text buttons, `confirm()` dialogs, no timer, separate settings window) with a card-style floating toolbar matching the Dadan/Loom-inspired design in `docs/superpowers/specs/2026-07-26-toolbar-redesign-design.md` — expanded card (idle/preview) that shrinks to a compact pill (recording/paused), a 3-2-1 countdown overlay, a redesigned area-select with draggable resize handles, inline camera/mic settings, and a "open last recording's folder" shortcut.

**Architecture:** Toolbar stays a single frameless `BrowserWindow`; visual state is driven by a `state-*` CSS class on `<body>`, toggled by the existing `render()` function in `toolbar.js`, with the Electron window resizing between expanded/compact sizes via a new `toolbar:resize` IPC call. A brand-new frameless overlay window (`src/windows/countdown/`) shows the 3-2-1 countdown, reusing the same transparent/alwaysOnTop/fullscreen pattern as `createOverlayWindow()`/`createAreaSelectWindow()` in `src/main/index.js`. `src/windows/areaselect/` gets drag-resize handles and a floating "Iniciar gravação" button added to its existing mousedown/move/up rectangle logic. `src/windows/settings/` is deleted entirely; its two dropdowns move inline into the toolbar card, reusing the existing `settings:get`/`settings:update` IPC untouched.

**Tech Stack:** Electron 32 (no bundler — renderer files use inlined logic copies and `<script>` tags, not `require()`), `node:test` + `node:assert` for `src/lib/` unit tests, new dependency `lucide-static` (prebuilt SVG icon strings, no runtime JS).

## Global Constraints

- No bundler in this project — any logic shared between `src/lib/*.js` (tested) and a renderer script must be duplicated inline in the renderer file with a `// Keep in sync with src/lib/X.js` comment, matching the existing pattern in `src/windows/toolbar/toolbar.js:1` and `:93-94`.
- Palette (exact values, from spec): window bg `#18181B`, card surface `#232326`, border `#2E2E32`, text primary `#E4E4E7`, text secondary `#8A8A93`, record accent `#FF3B30`, confirm accent `#30D158`.
- Typography: Inter, weights 400 (body) / 500 (labels) / 600 (buttons/title). No bundler means no `@font-face` download step — use the system font stack fallback `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (Inter is not guaranteed installed, but this matches how the rest of the app already handles fonts — no existing `@font-face` in the codebase).
- Icons: `lucide-static` SVGs, stroke-width 1.75, size 18-20px, inlined as literal `<svg>` markup (copied from the mockup artifact, which already has the exact paths) — no icon-font, no runtime `lucide` JS.
- Card `border-radius: 14px`, soft `box-shadow` (window itself stays transparent — only the card surface is opaque).
- Respect `prefers-reduced-motion` for the record-button pulse and countdown animation (already a pattern to introduce, not one that exists yet).
- `settings:get` / `settings:update` / `settings:changed` / `appSettings` shape (`{ cameraId, micEnabled, micId, systemAudioEnabled }`) do not change — only which UI consumes them moves.
- Every new IPC channel follows the existing naming convention: `namespace:verb` (e.g. `toolbar:resize`, `export:open-last-folder`), matching `capture:list-sources`, `areaselect:pick`, `settings:get`.

---

### Task 1: `lucide-static` dependency + shared icon constants

**Files:**
- Modify: `package.json`
- Create: `src/lib/icons.js`
- Test: `test/icons.test.js`

**Interfaces:**
- Produces: `ICONS` object exported from `src/lib/icons.js`, keys `monitor`, `crop`, `chevronDown`, `circle` (filled), `pen`, `arrowUpRight`, `folderOpen`, `pause`, `play`, `square`, `check`, `x`. Each value is a literal SVG string (`<svg viewBox="0 0 24 24" ...>...</svg>`) with `stroke-width="1.75"` baked in except `circle` (filled, no stroke). Later tasks inline these same strings directly into HTML (no bundler — see Global Constraints), but this file is the single source of truth other lib tests / future renderer copies are diffed against.

- [ ] **Step 1: Add `lucide-static` to `package.json` dependencies**

Edit `package.json` `dependencies` block to add, alphabetically before `ffmpeg-static`:

```json
"lucide-static": "^0.469.0",
```

- [ ] **Step 2: Install it**

Run: `npm install`
Expected: `node_modules/lucide-static` exists, `package-lock.json` updated.

- [ ] **Step 3: Write the failing test**

Create `test/icons.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { ICONS } = require('../src/lib/icons');

test('exposes an SVG string for every required icon key', () => {
  const requiredKeys = [
    'monitor', 'crop', 'chevronDown', 'circle',
    'pen', 'arrowUpRight', 'folderOpen',
    'pause', 'play', 'square', 'check', 'x'
  ];
  for (const key of requiredKeys) {
    assert.ok(typeof ICONS[key] === 'string' && ICONS[key].length > 0, `missing icon: ${key}`);
    assert.ok(ICONS[key].startsWith('<svg'), `icon ${key} is not an SVG string`);
  }
});

test('stroke icons declare stroke-width 1.75', () => {
  const strokeKeys = ['monitor', 'crop', 'chevronDown', 'pen', 'arrowUpRight', 'folderOpen', 'pause', 'play', 'square', 'check', 'x'];
  for (const key of strokeKeys) {
    assert.ok(ICONS[key].includes('stroke-width="1.75"'), `icon ${key} missing stroke-width 1.75`);
  }
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/lib/icons'`

- [ ] **Step 5: Write the implementation**

Create `src/lib/icons.js`. Pull each raw path from `node_modules/lucide-static/icons/*.svg`, wrap with `stroke-width="1.75"` (default lucide-static ships `stroke-width="2"` — override it), collapse to single-line strings:

```js
const ICONS = {
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>',
  crop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  circle: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  arrowUpRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  folderOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7Z"/></svg>',
  square: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

module.exports = { ICONS };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all `icons.test.js` cases green, plus existing 5 suites still passing).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/icons.js test/icons.test.js
git commit -m "feat: add lucide-static dependency and shared icon SVG constants"
```

---

### Task 2: Countdown overlay window (3-2-1)

**Files:**
- Create: `src/windows/countdown/index.html`
- Create: `src/windows/countdown/countdown.js`
- Create: `src/windows/countdown/preload.js`
- Modify: `src/main/index.js`

**Interfaces:**
- Consumes: none from earlier tasks.
- Produces: `createCountdownWindow()` function in `src/main/index.js`, same shape as `createAreaSelectWindow()` — returns a `Promise<void>` that resolves once the countdown finishes and the window has closed. Exposed to the toolbar renderer indirectly via a new IPC handler `ipcMain.handle('countdown:run', () => createCountdownWindow())` (invoked from `toolbar.js` in Task 4).

- [ ] **Step 1: Create the HTML**

Create `src/windows/countdown/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contagem</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    #num {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 160px;
      font-weight: 600;
      color: #fff;
      line-height: 1;
      text-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
      animation: countScale 1s ease-out;
    }
    @keyframes countScale {
      0% { opacity: 0; transform: scale(1.4); }
      30% { opacity: 1; transform: scale(1); }
      100% { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      #num { animation: none; }
    }
  </style>
</head>
<body>
  <div id="num">3</div>
  <script src="countdown.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create the renderer script**

Create `src/windows/countdown/countdown.js`:

```js
const numEl = document.getElementById('num');
let count = 3;

function tick() {
  numEl.textContent = String(count);
  // restart the CSS animation on each tick
  numEl.style.animation = 'none';
  // eslint-disable-next-line no-unused-expressions
  numEl.offsetHeight;
  numEl.style.animation = '';

  count -= 1;
  if (count < 0) {
    window.countdownBridge.done();
    return;
  }
  setTimeout(tick, 1000);
}

tick();
```

- [ ] **Step 3: Create the preload script**

Create `src/windows/countdown/preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('countdownBridge', {
  done: () => ipcRenderer.send('countdown:done')
});
```

- [ ] **Step 4: Add `createCountdownWindow()` to main process**

In `src/main/index.js`, add after `createOverlayWindow()` (which ends at line 93 per current file):

```js
function createCountdownWindow() {
  return new Promise((resolve) => {
    const primary = screen.getPrimaryDisplay();
    const win = new BrowserWindow({
      x: 0,
      y: 0,
      width: primary.bounds.width,
      height: primary.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      webPreferences: {
        preload: require('path').join(__dirname, '../windows/countdown/preload.js'),
        contextIsolation: true
      }
    });
    win.loadFile(require('path').join(__dirname, '../windows/countdown/index.html'));

    let settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('countdown:done', onDone);
      if (!win.isDestroyed()) win.close();
      resolve();
    }
    function onDone() {
      finish();
    }
    ipcMain.on('countdown:done', onDone);
    win.on('closed', finish);
  });
}
```

Check existing `createAreaSelectWindow()`/`createOverlayWindow()` in `src/main/index.js` for the exact `require('path')`/import style already used at the top of the file (likely a top-level `const path = require('path')` or inline `.loadFile('../windows/overlay/index.html')` with a relative string) — match whatever pattern the file already uses instead of introducing a new one. If the file loads HTML via a relative string path directly (e.g. `win.loadFile('../windows/overlay/index.html')`), use that same relative-string style here: `win.loadFile('../windows/countdown/index.html')`.

- [ ] **Step 5: Register the IPC handler**

Inside the `app.whenReady().then(...)` block in `src/main/index.js`, next to `ipcMain.handle('areaselect:pick', ...)`, add:

```js
ipcMain.handle('countdown:run', () => createCountdownWindow());
```

- [ ] **Step 6: Manual verification**

Run: `npm start`
Expected: app launches with no errors (countdown window is not yet triggered by any UI — that wiring happens in Task 4/5). Confirm no console errors about missing files.

- [ ] **Step 7: Commit**

```bash
git add src/windows/countdown src/main/index.js
git commit -m "feat: add 3-2-1 countdown overlay window"
```

---

### Task 3: Area-select — resize handles, dimension label, start button

**Files:**
- Modify: `src/windows/areaselect/index.html`
- Modify: `src/windows/areaselect/areaselect.js`
- Test: manual (no DOM test infra in this project — see Global Constraints)

**Interfaces:**
- Consumes: `window.areaSelectBridge.submit(rect)` (unchanged, from `src/windows/areaselect/preload.js`).
- Produces: same `submit(rect | null)` contract — `rect` shape `{x, y, width, height}` (already normalized, non-negative) or `null` on Escape-cancel. No signature change, so `src/main/index.js`'s `onResult` handler and `toCropParams` call are untouched.

- [ ] **Step 1: Rewrite the HTML structure**

Replace `src/windows/areaselect/index.html` contents:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Selecionar Área</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.55);
      cursor: crosshair;
      overflow: hidden;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #hint {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      color: #E4E4E7;
      font-size: 13px;
      background: rgba(0, 0, 0, 0.4);
      padding: 6px 14px;
      border-radius: 8px;
      pointer-events: none;
    }
    #rect {
      position: absolute;
      display: none;
      border: 1.5px solid #30D158;
      box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.55);
      background: transparent;
    }
    .handle {
      position: absolute;
      width: 10px;
      height: 10px;
      margin: -5px;
      background: #30D158;
      border: 1.5px solid #0E0E10;
      border-radius: 50%;
    }
    .handle[data-pos="nw"] { left: 0; top: 0; cursor: nwse-resize; }
    .handle[data-pos="n"]  { left: 50%; top: 0; cursor: ns-resize; }
    .handle[data-pos="ne"] { left: 100%; top: 0; cursor: nesw-resize; }
    .handle[data-pos="e"]  { left: 100%; top: 50%; cursor: ew-resize; }
    .handle[data-pos="se"] { left: 100%; top: 100%; cursor: nwse-resize; }
    .handle[data-pos="s"]  { left: 50%; top: 100%; cursor: ns-resize; }
    .handle[data-pos="sw"] { left: 0; top: 100%; cursor: nesw-resize; }
    .handle[data-pos="w"]  { left: 0; top: 50%; cursor: ew-resize; }
    #dimLabel {
      position: absolute;
      display: none;
      top: -26px;
      left: 0;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 11px;
      color: #fff;
      background: rgba(0, 0, 0, 0.6);
      padding: 3px 7px;
      border-radius: 5px;
      white-space: nowrap;
    }
    #startBtn {
      position: absolute;
      display: none;
      bottom: -44px;
      left: 50%;
      transform: translateX(-50%);
      background: #30D158;
      color: #0E2A14;
      font-size: 12.5px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      display: none;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    #startBtn.visible { display: flex; }
  </style>
</head>
<body>
  <div id="hint">Arraste para selecionar a área. Esc para cancelar.</div>
  <div id="rect">
    <div id="dimLabel"></div>
    <div class="handle" data-pos="nw"></div>
    <div class="handle" data-pos="n"></div>
    <div class="handle" data-pos="ne"></div>
    <div class="handle" data-pos="e"></div>
    <div class="handle" data-pos="se"></div>
    <div class="handle" data-pos="s"></div>
    <div class="handle" data-pos="sw"></div>
    <div class="handle" data-pos="w"></div>
    <button id="startBtn">Iniciar gravação</button>
  </div>
  <script src="areaselect.js"></script>
</body>
</html>
```

- [ ] **Step 2: Rewrite the interaction logic**

Replace `src/windows/areaselect/areaselect.js` contents. This keeps the original mousedown/move/up draw gesture for the *first* drag, then switches to a post-draw adjust mode with handle-drag and whole-rect-move, mirroring the existing normalize-with-`Math.min`/`Math.abs` approach from the current file:

```js
const rectEl = document.getElementById('rect');
const dimLabel = document.getElementById('dimLabel');
const startBtn = document.getElementById('startBtn');
const hint = document.getElementById('hint');

let phase = 'drawing'; // 'drawing' | 'adjusting'
let dragging = false;
let startX = 0;
let startY = 0;

// current committed rect (top-left/width-height, always normalized)
let rect = null;

function applyRectStyle() {
  rectEl.style.left = rect.x + 'px';
  rectEl.style.top = rect.y + 'px';
  rectEl.style.width = rect.width + 'px';
  rectEl.style.height = rect.height + 'px';
  dimLabel.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
}

function enterAdjustMode() {
  phase = 'adjusting';
  hint.style.display = 'none';
  dimLabel.style.display = 'block';
  startBtn.classList.add('visible');
}

// ---- Phase 1: initial draw gesture ----
document.addEventListener('mousedown', (e) => {
  if (phase !== 'drawing') return;
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  rect = { x: startX, y: startY, width: 0, height: 0 };
  rectEl.style.display = 'block';
  applyRectStyle();
});

document.addEventListener('mousemove', (e) => {
  if (phase === 'drawing' && dragging) {
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);
    rect = { x, y, width, height };
    applyRectStyle();
  } else if (phase === 'adjusting' && activeHandle) {
    adjustFromHandle(e);
  } else if (phase === 'adjusting' && movingRect) {
    rect.x = e.clientX - moveOffsetX;
    rect.y = e.clientY - moveOffsetY;
    applyRectStyle();
  }
});

document.addEventListener('mouseup', () => {
  if (phase === 'drawing' && dragging) {
    dragging = false;
    if (rect.width < 5 || rect.height < 5) {
      rectEl.style.display = 'none';
      rect = null;
      return;
    }
    enterAdjustMode();
  }
  activeHandle = null;
  movingRect = false;
});

// ---- Phase 2: handle-drag resize ----
let activeHandle = null;

document.querySelectorAll('.handle').forEach((handle) => {
  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    activeHandle = handle.dataset.pos;
  });
});

function adjustFromHandle(e) {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  if (activeHandle.includes('n')) {
    rect.height = bottom - e.clientY;
    rect.y = e.clientY;
  }
  if (activeHandle.includes('s')) {
    rect.height = e.clientY - rect.y;
  }
  if (activeHandle.includes('w')) {
    rect.width = right - e.clientX;
    rect.x = e.clientX;
  }
  if (activeHandle.includes('e')) {
    rect.width = e.clientX - rect.x;
  }

  rect.width = Math.max(10, rect.width);
  rect.height = Math.max(10, rect.height);
  applyRectStyle();
}

// ---- Phase 2: whole-rect move (drag from inside, not on a handle) ----
let movingRect = false;
let moveOffsetX = 0;
let moveOffsetY = 0;

rectEl.addEventListener('mousedown', (e) => {
  if (phase !== 'adjusting') return;
  if (e.target.classList.contains('handle') || e.target === startBtn) return;
  movingRect = true;
  moveOffsetX = e.clientX - rect.x;
  moveOffsetY = e.clientY - rect.y;
});

// ---- Confirm / cancel ----
startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.areaSelectBridge.submit({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.areaSelectBridge.submit(null);
  }
});
```

Note: `src/windows/areaselect/preload.js` is unchanged (already exposes `window.areaSelectBridge.submit`).

- [ ] **Step 3: Manual verification**

Run: `npm start`, trigger area-select (via existing `confirm()` flow in current `toolbar.js` — Task 4 will replace this trigger, but for this task's verification the old flow still works end-to-end since `toolbar.js` hasn't changed yet).
Expected: drag draws rectangle → on release, 8 green handles appear + dimension label + "Iniciar gravação" button below the rect. Dragging any handle resizes from that edge/corner. Dragging inside the rect (not on a handle) moves the whole rect. Esc at any point cancels and closes the window. Clicking "Iniciar gravação" resolves the picker with the final rect (verify by checking `recorderApi.start` receives a non-null `cropRect` — add a temporary `console.log` if needed, then remove it).

- [ ] **Step 4: Commit**

```bash
git add src/windows/areaselect/index.html src/windows/areaselect/areaselect.js
git commit -m "feat: add resize handles, dimension label, and start button to area select"
```

---

### Task 4: `lastSavedPath` tracking + open-folder IPC

**Files:**
- Modify: `src/main/export.js`
- Modify: `src/main/index.js`

**Interfaces:**
- Consumes: `saveRecording(buffer, browserWindow)` existing signature (unchanged return shape `{ success, path?, format?, warning? }`).
- Produces: module-level `lastSavedPath` variable in `src/main/index.js`, updated after every successful `saveRecording()` call. New IPC handler `ipcMain.handle('export:open-last-folder', () => { ... })` — returns `{ opened: boolean }`.

- [ ] **Step 1: Track `lastSavedPath` in the `export:save` handler**

In `src/main/index.js`, locate the existing handler (currently around line 155):

```js
ipcMain.handle('export:save', async (event, arrayBuffer) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return saveRecording(Buffer.from(arrayBuffer), win);
});
```

Replace with:

```js
let lastSavedPath = null;

ipcMain.handle('export:save', async (event, arrayBuffer) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await saveRecording(Buffer.from(arrayBuffer), win);
  if (result.success) {
    lastSavedPath = result.path;
  }
  return result;
});

ipcMain.handle('export:open-last-folder', () => {
  if (!lastSavedPath) return { opened: false };
  shell.showItemInFolder(lastSavedPath);
  return { opened: true };
});
```

- [ ] **Step 2: Add `shell` to the Electron import**

At the top of `src/main/index.js`, the existing import (currently line 1) is:

```js
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
```

Change to:

```js
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
```

- [ ] **Step 3: Manual verification**

Run: `npm start`, record a short clip, click Save (existing UI still works — Task 5 adds the folder-open button). In the running app's devtools console (toolbar window), run:

```js
await window.gravador.openLastFolder ? window.gravador.openLastFolder() : 'bridge not wired yet'
```

Expected at this point: bridge not wired yet (that's Task 5) — instead, verify manually via a temporary `ipcRenderer.invoke('export:open-last-folder')` in devtools console after a successful save. Expected: Windows Explorer opens with the saved file highlighted. Confirm `{ opened: false }` is returned if invoked with nothing ever saved in the session (restart app, invoke immediately).

- [ ] **Step 4: Commit**

```bash
git add src/main/index.js
git commit -m "feat: track last saved recording path and add open-folder IPC handler"
```

---

### Task 5: Toolbar preload — new bridge methods

**Files:**
- Modify: `src/windows/toolbar/preload.js`

**Interfaces:**
- Consumes: `countdown:run`, `export:open-last-folder`, `toolbar:resize` IPC channels (handlers from Task 2, Task 4, and Task 6 respectively).
- Produces: `window.gravador.runCountdown()`, `window.gravador.openLastFolder()`, `window.gravador.resizeWindow(size)` — consumed by `toolbar.js` in Task 7. Also removes `window.gravador.openSettings` (settings window is deleted in Task 8).

- [ ] **Step 1: Edit the preload bridge**

Current `src/windows/toolbar/preload.js` (11 lines) exposes:

```js
listSources: () => ipcRenderer.invoke('capture:list-sources'),
pickArea: () => ipcRenderer.invoke('areaselect:pick'),
setOverlayTool: (payload) => ipcRenderer.send('overlay:set-tool', payload),
openSettings: () => ipcRenderer.send('open-settings'),
getSettings: () => ipcRenderer.invoke('settings:get'),
saveRecording: (arrayBuffer) => ipcRenderer.invoke('export:save', arrayBuffer),
notifyState: (state) => ipcRenderer.send('recording:state-changed', state)
```

Replace the whole exposed object with:

```js
listSources: () => ipcRenderer.invoke('capture:list-sources'),
pickArea: () => ipcRenderer.invoke('areaselect:pick'),
setOverlayTool: (payload) => ipcRenderer.send('overlay:set-tool', payload),
getSettings: () => ipcRenderer.invoke('settings:get'),
updateSettings: (settings) => ipcRenderer.send('settings:update', settings),
onSettingsChanged: (callback) => ipcRenderer.on('settings:changed', (event, settings) => callback(settings)),
saveRecording: (arrayBuffer) => ipcRenderer.invoke('export:save', arrayBuffer),
notifyState: (state) => ipcRenderer.send('recording:state-changed', state),
runCountdown: () => ipcRenderer.invoke('countdown:run'),
openLastFolder: () => ipcRenderer.invoke('export:open-last-folder'),
resizeWindow: (size) => ipcRenderer.send('toolbar:resize', size)
```

(`updateSettings`/`onSettingsChanged` are new — needed because settings UI moves into the toolbar card in Task 7, replacing `src/windows/settings/settings.js`'s `pushUpdate()` and its unused `settings:changed` listener gap noted in the codebase mapping.)

- [ ] **Step 2: Manual verification**

Run: `npm start`. Expected: app launches without preload errors (toolbar.js hasn't been updated yet, so `openSettings` calls in the old `toolbar.js` will now throw — this is expected and fixed in Task 7; confirm the *specific* error is `window.gravador.openSettings is not a function`, not something else).

- [ ] **Step 3: Commit**

```bash
git add src/windows/toolbar/preload.js
git commit -m "feat: expose countdown, open-folder, resize, and settings-update bridge methods"
```

---

### Task 6: Main process — `toolbar:resize` IPC + remove settings window

**Files:**
- Modify: `src/main/index.js`
- Delete: `src/windows/settings/index.html`
- Delete: `src/windows/settings/settings.js`
- Delete: `src/windows/settings/preload.js`

**Interfaces:**
- Consumes: `toolbar:resize` payload shape `{ width: number, height: number }`, sent from `toolbar.js` (Task 7) whenever `render()` switches between expanded/compact states.
- Produces: nothing new consumed by later tasks — this is the last main-process change.

- [ ] **Step 1: Add the resize handler**

In `src/main/index.js`, `createToolbarWindow()` currently stores the window in a module-level `toolbarWindow` variable (line 8) that per the codebase mapping is set but never read elsewhere. Add a read site: inside the `app.whenReady().then(...)` IPC registration block, next to `ipcMain.on('recording:state-changed', ...)`:

```js
ipcMain.on('toolbar:resize', (event, { width, height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setSize(width, height, true);
});
```

(Using `BrowserWindow.fromWebContents(event.sender)` rather than the module-level `toolbarWindow` variable keeps this handler correct even if called from a window other than the toolbar — matches the existing pattern already used in the `export:save` handler.)

- [ ] **Step 2: Remove settings window creation and its IPC**

Delete the `createSettingsWindow()` function (current lines 103-115) and the `settingsWindow` module-level variable declaration.

Delete the `ipcMain.on('open-settings', () => createSettingsWindow());` line (current line 154).

Keep `ipcMain.handle('settings:get', ...)` and `ipcMain.on('settings:update', ...)` exactly as-is (they still serve the toolbar's inline dropdowns after Task 7).

- [ ] **Step 3: Delete the settings window directory**

```bash
git rm -r src/windows/settings
```

- [ ] **Step 4: Run existing test suite**

Run: `npm test`
Expected: PASS — no `test/` file references `src/windows/settings/` (confirmed in codebase mapping: settings has no automated tests).

- [ ] **Step 5: Manual verification**

Run: `npm start`. Expected: app launches, no reference-error for `settingsWindow`/`createSettingsWindow` anywhere (grep confirms no leftover call sites). Toolbar's old Config button will now error on click (`ipcRenderer.send('open-settings')` goes nowhere) — expected, fixed by Task 7 removing that button entirely.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.js
git commit -m "feat: add toolbar:resize IPC and remove standalone settings window"
```

---

### Task 7: Toolbar HTML/CSS — card expanded + compact pill markup

**Files:**
- Modify: `src/windows/toolbar/index.html`
- Modify: `src/windows/toolbar/toolbar.css`

**Interfaces:**
- Consumes: `ICONS` values from `src/lib/icons.js` (Task 1) — copied as literal inline SVG (no `require()` available in renderer, per Global Constraints), matching exactly the strings the Task 1 test asserts on so a future audit can diff them.
- Produces: DOM element IDs consumed by `toolbar.js` in Task 8: `#card`, `#modeFullscreen`, `#modeArea`, `#cameraSelect`, `#micSelect`, `#sysAudioToggle`, `#btnRecord`, `#btnPen`, `#btnArrow`, `#btnOpenFolder`, `#btnSave`, `#btnDiscard`, `#btnClose`, `#pillTimer`, `#btnPause`, `#btnStop`. Body classes `state-idle` / `state-preview` / `state-recording` / `state-paused` toggled by `toolbar.js`.

- [ ] **Step 1: Rewrite `index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gravador de Tela</title>
  <link rel="stylesheet" href="toolbar.css">
</head>
<body class="state-idle">
  <div class="card" id="card">
    <div class="expanded-view">
      <div class="card-header" id="dragbar">
        <span class="title">Gravador de Tela</span>
        <span class="spacer"></span>
        <button class="icon-btn" id="btnClose" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="card-body">
        <div class="mode-row">
          <button class="mode-block active" id="modeFullscreen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>
            <span class="label">Tela Inteira</span>
          </button>
          <button class="mode-block" id="modeArea">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
            <span class="label">Área Customizada</span>
          </button>
        </div>

        <div class="field">
          <label for="cameraSelect">Câmera</label>
          <select id="cameraSelect"></select>
        </div>

        <div class="field">
          <label for="micSelect">Microfone</label>
          <select id="micSelect"></select>
          <div class="toggle-row">
            <span class="label">Áudio do sistema</span>
            <label class="switch">
              <input type="checkbox" id="sysAudioToggle">
              <span class="switch-track"></span>
            </label>
          </div>
        </div>

        <div class="record-row">
          <button class="record-btn" id="btnRecord" title="Gravar">
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>
          </button>
          <span class="rec-label">Gravar</span>
        </div>

        <div class="preview-actions" id="previewActions">
          <button class="btn-save" id="btnSave">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            Salvar
          </button>
          <button class="btn-discard" id="btnDiscard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            Descartar
          </button>
        </div>

        <div class="tool-row">
          <button class="icon-btn" id="btnPen" title="Caneta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="icon-btn" id="btnArrow" title="Seta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
          </button>
          <button class="icon-btn" id="btnOpenFolder" title="Abrir pasta da última gravação" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="compact-view">
      <div class="rec-dot"></div>
      <span class="timer" id="pillTimer">00:00</span>
      <div class="pill-controls">
        <button class="icon-btn" id="btnPause" title="Pausar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        </button>
        <button class="icon-btn" id="btnStop" title="Parar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
        </button>
      </div>
    </div>
  </div>

  <canvas id="compositeCanvas" style="display:none"></canvas>
  <video id="screenVideo" style="display:none" autoplay muted></video>

  <script src="../../renderer/recorder.js"></script>
  <script src="toolbar.js"></script>
</body>
</html>
```

- [ ] **Step 2: Rewrite `toolbar.css`**

```css
* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: transparent;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #E4E4E7;
  overflow: hidden;
}

.card {
  background: #232326;
  border: 1px solid #2E2E32;
  border-radius: 14px;
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35);
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* body state controls which view is visible; window is resized to match by toolbar.js */
.compact-view { display: none; }
body.state-recording .expanded-view,
body.state-paused .expanded-view { display: none; }
body.state-recording .compact-view,
body.state-paused .compact-view { display: flex; }

.expanded-view {
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  padding: 12px 14px 10px;
  -webkit-app-region: drag;
}

.card-header .title {
  font-size: 12.5px;
  font-weight: 600;
  color: #E4E4E7;
  letter-spacing: 0.01em;
}

.card-header .spacer { flex: 1; }

.icon-btn {
  -webkit-app-region: no-drag;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8A8A93;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}
.icon-btn svg { width: 15px; height: 15px; }
.icon-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); color: #E4E4E7; }
.icon-btn:disabled { opacity: 0.35; cursor: default; }
.icon-btn.active { color: #FF6A61; background: rgba(255, 59, 48, 0.12); }

.card-body {
  padding: 4px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mode-block {
  -webkit-app-region: no-drag;
  border: 1px solid #2E2E32;
  border-radius: 10px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #8A8A93;
  background: rgba(255, 255, 255, 0.015);
  cursor: pointer;
}
.mode-block svg { width: 18px; height: 18px; }
.mode-block .label { font-size: 11.5px; font-weight: 500; }
.mode-block.active {
  border-color: rgba(255, 59, 48, 0.5);
  background: rgba(255, 59, 48, 0.08);
  color: #FF6A61;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field label {
  font-size: 10.5px;
  font-weight: 500;
  color: #8A8A93;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.field select {
  -webkit-app-region: no-drag;
  border: 1px solid #2E2E32;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12.5px;
  color: #E4E4E7;
  background: #1E1E21;
  font-family: inherit;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px 0;
}
.toggle-row .label { font-size: 12px; color: #8A8A93; }

.switch {
  -webkit-app-region: no-drag;
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}
.switch input { opacity: 0; width: 0; height: 0; }
.switch-track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.15s;
}
.switch-track::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #C8C8CE;
  transition: left 0.15s, background 0.15s;
}
.switch input:checked + .switch-track { background: rgba(48, 209, 88, 0.35); }
.switch input:checked + .switch-track::after { left: 16px; background: #30D158; }

.record-row {
  -webkit-app-region: no-drag;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 6px 0 2px;
}

.record-btn {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: #FF3B30;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 2.2s ease-out infinite;
}
.record-btn svg { width: 22px; height: 22px; }
.record-btn:disabled { opacity: 0.4; cursor: default; animation: none; }

@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.45); }
  70%  { box-shadow: 0 0 0 14px rgba(255, 59, 48, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .record-btn { animation: none; }
}

.rec-label {
  font-size: 11.5px;
  font-weight: 600;
  color: #8A8A93;
  letter-spacing: 0.02em;
}

.preview-actions {
  display: none;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 6px 0 2px;
}
body.state-preview .preview-actions { display: grid; }
body.state-preview .record-row,
body.state-preview .mode-row,
body.state-preview .field { display: none; }

.btn-save, .btn-discard {
  -webkit-app-region: no-drag;
  border: none;
  border-radius: 9px;
  padding: 10px 0;
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  font-family: inherit;
}
.btn-save { background: #30D158; color: #0E2A14; }
.btn-discard {
  border: 1px solid rgba(255, 59, 48, 0.45);
  color: #FF6A61;
  background: rgba(255, 59, 48, 0.06);
}

.tool-row {
  display: flex;
  justify-content: center;
  gap: 6px;
  border-top: 1px solid #2E2E32;
  padding-top: 10px;
}
.tool-row .icon-btn {
  width: 30px;
  height: 30px;
  border: 1px solid #2E2E32;
  border-radius: 8px;
}

/* ---------- compact pill (recording/paused) ---------- */
.compact-view {
  align-items: center;
  padding: 0 10px;
  gap: 10px;
  height: 100%;
  -webkit-app-region: drag;
}

.rec-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #FF3B30;
  flex-shrink: 0;
  animation: dotpulse 1.4s ease-in-out infinite;
}
@keyframes dotpulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .rec-dot { animation: none; }
}
body.state-paused .rec-dot { animation: none; opacity: 0.4; }

.timer {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: #E4E4E7;
  font-variant-numeric: tabular-nums;
  flex: 1;
}

.pill-controls {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 4px;
}
.pill-controls .icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 3: Manual verification (visual only — `toolbar.js` still references old element IDs, so JS errors are expected here)**

Run: `npm start`. Expected: toolbar window shows the new expanded card visually (idle state: Tela Inteira active, empty dropdowns, red pulsing record button, 3 tool icons). Devtools console will show reference errors from the old `toolbar.js` (e.g. `Cannot read properties of null (reading 'addEventListener')` for `btnStart` etc.) — this is expected and resolved by Task 8. Confirm visually the card matches the mockup: colors, radius, spacing, pulse animation on the record button.

- [ ] **Step 4: Commit**

```bash
git add src/windows/toolbar/index.html src/windows/toolbar/toolbar.css
git commit -m "feat: rewrite toolbar HTML/CSS for card-based expanded/compact states"
```

---

### Task 8: Toolbar JS — state machine, dropdowns, timer, resize, new flows

**Files:**
- Modify: `src/windows/toolbar/toolbar.js`

**Interfaces:**
- Consumes: everything from `src/windows/toolbar/preload.js` (`window.gravador.*`, Task 5), DOM IDs from Task 7's `index.html`, `window.recorderApi.*` (pre-existing, unchanged), `src/lib/toolbarState.js` logic (duplicated inline per Global Constraints, same as today).
- Produces: nothing consumed by later tasks — this is the last renderer change.

- [ ] **Step 1: Rewrite `toolbar.js` in full**

```js
// Keep in sync with src/lib/toolbarState.js — inlined here because the renderer has no require() without a bundler.
const TRANSITIONS = {
  idle: { start: 'recording' },
  recording: { pause: 'paused', stop: 'preview' },
  paused: { resume: 'recording', stop: 'preview' },
  preview: { save: 'idle', delete: 'idle' }
};

let state = 'idle';
function transition(action) {
  const next = TRANSITIONS[state] && TRANSITIONS[state][action];
  if (!next) return false;
  state = next;
  return true;
}

const EXPANDED_SIZE = { width: 296, height: 420 };
const COMPACT_SIZE = { width: 176, height: 48 };

const body = document.body;
const modeFullscreen = document.getElementById('modeFullscreen');
const modeArea = document.getElementById('modeArea');
const btnRecord = document.getElementById('btnRecord');
const btnPause = document.getElementById('btnPause');
const btnStop = document.getElementById('btnStop');
const btnSave = document.getElementById('btnSave');
const btnDiscard = document.getElementById('btnDiscard');
const btnOpenFolder = document.getElementById('btnOpenFolder');
const btnClose = document.getElementById('btnClose');
const btnPen = document.getElementById('btnPen');
const btnArrow = document.getElementById('btnArrow');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const sysAudioToggle = document.getElementById('sysAudioToggle');
const pillTimer = document.getElementById('pillTimer');

let captureMode = 'fullscreen'; // 'fullscreen' | 'area'
let lastRecordingBlob = null;
let recordingStartedAt = null;
let timerInterval = null;
let hasSavedThisSession = false;

function render() {
  body.className = `state-${state}`;

  const isIdleOrPreview = state === 'idle' || state === 'preview';
  body.classList.toggle('compact', !isIdleOrPreview);

  btnRecord.disabled = state !== 'idle' || captureMode === 'area';
  btnPause.textContent = ''; // icon-only in compact pill, swapped below
  btnPause.title = state === 'paused' ? 'Retomar' : 'Pausar';
  btnPause.innerHTML = state === 'paused'
    ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7Z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

  window.gravador.resizeWindow(isIdleOrPreview ? EXPANDED_SIZE : COMPACT_SIZE);
  window.gravador.notifyState(state);
}

function startTimer() {
  recordingStartedAt = Date.now();
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  pillTimer.textContent = '00:00';
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - recordingStartedAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  pillTimer.textContent = `${mm}:${ss}`;
}

// ---- Capture mode selection ----
modeFullscreen.addEventListener('click', () => {
  if (state !== 'idle') return;
  captureMode = 'fullscreen';
  modeFullscreen.classList.add('active');
  modeArea.classList.remove('active');
  render();
});

modeArea.addEventListener('click', async () => {
  if (state !== 'idle') return;
  captureMode = 'area';
  modeArea.classList.add('active');
  modeFullscreen.classList.remove('active');
  render();

  const cropRect = await window.gravador.pickArea();
  if (!cropRect) {
    // user pressed Escape — revert to fullscreen mode
    captureMode = 'fullscreen';
    modeFullscreen.classList.add('active');
    modeArea.classList.remove('active');
    render();
    return;
  }
  await beginRecording(cropRect);
});

// ---- Recording flow ----
async function beginRecording(cropRect) {
  const sources = await window.gravador.listSources();
  const screenSource = sources.find((s) => s.name.toLowerCase().includes('screen')) || sources[0];
  if (!screenSource) {
    alert('Nenhuma tela encontrada para gravar.');
    return;
  }

  await window.gravador.runCountdown();
  await window.recorderApi.start(screenSource.id, cropRect);
  transition('start');
  startTimer();
  render();
}

btnRecord.addEventListener('click', async () => {
  if (state !== 'idle' || captureMode !== 'fullscreen') return;
  await beginRecording(null);
});

btnPause.addEventListener('click', () => {
  if (state === 'recording') {
    window.recorderApi.pause();
    transition('pause');
  } else if (state === 'paused') {
    window.recorderApi.resume();
    transition('resume');
  }
  render();
});

btnStop.addEventListener('click', async () => {
  lastRecordingBlob = await window.recorderApi.stop();
  stopTimer();
  transition('stop');
  render();
});

btnSave.addEventListener('click', async () => {
  if (!lastRecordingBlob) return;
  try {
    const arrayBuffer = await lastRecordingBlob.arrayBuffer();
    const result = await window.gravador.saveRecording(arrayBuffer);
    if (result.success) {
      if (result.format === 'webm') {
        alert('Não foi possível converter para MP4, salvo como WebM: ' + result.path);
      }
      hasSavedThisSession = true;
      btnOpenFolder.disabled = false;
      lastRecordingBlob = null;
      transition('save');
      render();
    }
  } catch (err) {
    alert('Erro ao salvar a gravação: ' + err.message);
  }
});

btnDiscard.addEventListener('click', () => {
  lastRecordingBlob = null;
  transition('delete');
  render();
});

btnOpenFolder.addEventListener('click', async () => {
  await window.gravador.openLastFolder();
});

btnClose.addEventListener('click', () => {
  window.close();
});

// ---- Pen/Arrow overlay tool wiring — nextColor cycle inlined (mirrors src/lib/colorCycle.js) ----
const { nextColor } = (function () {
  const CYCLE = [null, '#000000', '#0000FF', '#FF0000'];
  return {
    nextColor(current) {
      const idx = CYCLE.indexOf(current);
      if (idx === -1) return null;
      return CYCLE[(idx + 1) % CYCLE.length];
    }
  };
})();

let penColor = null;
let arrowOn = false;

btnPen.addEventListener('click', () => {
  penColor = nextColor(penColor);
  arrowOn = false;
  btnArrow.classList.remove('active');
  btnPen.classList.toggle('active', !!penColor);
  window.gravador.setOverlayTool({ tool: penColor ? 'pen' : 'none', color: penColor });
});

btnArrow.addEventListener('click', () => {
  arrowOn = !arrowOn;
  penColor = null;
  btnPen.classList.remove('active');
  btnArrow.classList.toggle('active', arrowOn);
  window.gravador.setOverlayTool({ tool: arrowOn ? 'arrow' : 'none', color: '#000000' });
});

// ---- Inline settings: camera/mic dropdowns + system audio toggle ----
async function populateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();

  cameraSelect.innerHTML = '';
  const noCameraOpt = document.createElement('option');
  noCameraOpt.value = '';
  noCameraOpt.textContent = 'Nenhuma câmera';
  cameraSelect.appendChild(noCameraOpt);
  devices.filter((d) => d.kind === 'videoinput').forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || 'Câmera';
    cameraSelect.appendChild(opt);
  });

  micSelect.innerHTML = '';
  devices.filter((d) => d.kind === 'audioinput').forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || 'Microfone';
    micSelect.appendChild(opt);
  });
}

function pushSettingsUpdate() {
  window.gravador.updateSettings({
    cameraId: cameraSelect.value || null,
    micId: micSelect.value || null,
    micEnabled: true,
    systemAudioEnabled: sysAudioToggle.checked
  });
}

async function initSettings() {
  await populateDevices();
  const settings = await window.gravador.getSettings();
  cameraSelect.value = settings.cameraId || '';
  micSelect.value = settings.micId || '';
  sysAudioToggle.checked = !!settings.systemAudioEnabled;
}

cameraSelect.addEventListener('change', pushSettingsUpdate);
micSelect.addEventListener('change', pushSettingsUpdate);
sysAudioToggle.addEventListener('change', pushSettingsUpdate);

window.gravador.onSettingsChanged((settings) => {
  cameraSelect.value = settings.cameraId || '';
  micSelect.value = settings.micId || '';
  sysAudioToggle.checked = !!settings.systemAudioEnabled;
});

// ---- Init ----
btnOpenFolder.disabled = !hasSavedThisSession;
initSettings();
render();
```

Note on `pushSettingsUpdate`: the existing `appSettings` shape (from codebase mapping) is `{ cameraId, micEnabled, micId, systemAudioEnabled }` with `micEnabled` as a separate flag from device selection. The mockup/spec's single "Áudio do sistema" toggle maps only to `systemAudioEnabled`; `micEnabled` (whether the mic is used at all) has no dedicated control in the new inline card per the spec's component list (spec only lists one toggle, for system audio), so it's hardcoded to `true` to preserve prior always-on mic behavior.

- [ ] **Step 2: Manual verification — full idle→record→save loop**

Run: `npm start`.
Expected:
1. Card shows populated camera/mic dropdowns (real device labels).
2. Click "Tela Inteira" (already active) → click big red Gravar button → 3-2-1 countdown overlay appears fullscreen → countdown closes → toolbar shrinks to compact pill with pulsing dot and `00:00` ticking up every second.
3. Click Pause icon → dot stops pulsing, timer stops incrementing. Click again (now Play icon) → resumes.
4. Click Stop (square icon) → card expands back, shows Salvar/Descartar buttons.
5. Click Salvar → file save dialog appears (existing `saveRecording` flow) → after saving, folder icon in tool-row becomes enabled.
6. Click folder icon → Windows Explorer opens with the saved file highlighted.
7. Click "Área Customizada" → area-select overlay opens immediately (per spec's entry flow) → drag, adjust with handles, click "Iniciar gravação" inside the overlay → countdown → recording starts with cropped region.
8. Press Esc during an area-select in progress → returns to card in fullscreen mode, no recording started.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (all 6 suites: colorCycle, cropMath, ffmpegArgs, strokeFade, toolbarState, icons — `toolbar.js` has no automated tests per Global Constraints, this is manual-only).

- [ ] **Step 4: Commit**

```bash
git add src/windows/toolbar/toolbar.js
git commit -m "feat: wire new toolbar card to countdown, area-select, timer, and inline settings"
```

---

### Task 9: Final cleanup pass — dead code check

**Files:**
- Modify: `src/main/index.js` (only if dead code found)

**Interfaces:** none — verification-only task.

- [ ] **Step 1: Grep for leftover references to removed settings window**

Run: `grep -rn "createSettingsWindow\|settingsWindow\|open-settings\|openSettings" src/`
Expected: no matches (all removed in Task 6/Task 5/Task 8).

- [ ] **Step 2: Grep for the unused `toolbarWindow` variable**

Run: `grep -rn "toolbarWindow" src/main/index.js`
Expected: one match at the `createToolbarWindow()` assignment site. Per the codebase mapping this variable was already unused before this plan (pre-existing, not introduced by this work) — leave it as-is; it's out of scope for this redesign (no task in this plan touches it) unless it now causes a lint/dead-code failure in `npm test`. If `npm test` passes, leave it untouched.

- [ ] **Step 3: Run full test suite one more time**

Run: `npm test`
Expected: PASS, all 6 suites green.

- [ ] **Step 4: Full manual regression per spec's Verificação section**

Follow `docs/superpowers/specs/2026-07-26-toolbar-redesign-design.md`'s "Verificação" section line by line:
- `npm test` passes.
- Card expanded visual matches mockup; mode toggle; dropdowns show real devices; Gravar → countdown → recording → pill w/ running timer; stop → preview → Salvar → folder icon opens Explorer.
- Área Customizada: drag, adjust handles, dimension label updates live, click Iniciar, countdown, recording, confirm crop correct in final file.
- Esc cancels area selection at any point during adjustment.

- [ ] **Step 5: Commit (only if Step 2 required a change; otherwise skip — nothing to commit)**

```bash
git add src/main/index.js
git commit -m "chore: remove dead code left over from settings window removal"
```
