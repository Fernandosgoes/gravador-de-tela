# Gravador de Tela para Tutoriais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Electron desktop app (Windows) that records screen (full or custom area) + webcam bubble + mic/system audio, lets user annotate live with a 3-color pen and an arrow tool, and exports a lightweight, good-quality MP4.

**Architecture:** Electron main process owns window management (toolbar, transparent draw overlay, settings) and source capture (`desktopCapturer`). Renderer processes handle UI and media (`getUserMedia`, `MediaRecorder`, canvas compositing). A single compositing canvas in the toolbar/recorder renderer merges screen + overlay + webcam into one `MediaRecorder` stream (WebM/VP9). On save, main process shells out to `ffmpeg-static` to transcode WebM → MP4 (H.264, CRF 23).

**Tech Stack:** Electron, electron-builder, ffmpeg-static, vanilla JS/HTML/CSS (no framework — app is small, avoid build-step complexity), Node's built-in `node:test` + `assert` for unit tests (no extra test framework dependency needed).

## Global Constraints

- Target OS: Windows only (Electron `win32` build target).
- Distribution: GitHub repo, user clones/downloads and runs a ready `.exe` (via `electron-builder`), no toolchain install required by end user.
- Export format: MP4, H.264 video, CRF 23, AAC audio (exact ffmpeg args: `-c:v libx264 -crf 23 -preset medium -c:a aac`).
- Draw overlay: transparent, fullscreen, always-on-top, click-through when no tool active.
- Pen colors: exactly 3 — black `#000000`, blue `#0000FF`, red `#FF0000`.
- Strokes (pen and arrow) auto-fade/clear after 3000ms.
- Webcam bubble: ~160px circular, default bottom-right corner, draggable.
- Audio: mic and system audio each independently toggleable.
- Delete only discards the current in-memory recording buffer (no saved-recording history/gallery).
- No unrelated refactors; keep files small and single-purpose.

---

## File Structure

```
gravador-de-tela/
  package.json
  electron-builder.yml
  .gitignore
  README.md
  src/
    main/
      index.js          # app lifecycle, window creation, IPC wiring
      capture.js         # desktopCapturer source listing + area-select math
      export.js          # ffmpeg transcode WebM -> MP4, save dialog
    windows/
      toolbar/
        index.html
        toolbar.js        # button state machine (idle/recording/paused/preview)
        toolbar.css
      overlay/
        index.html
        overlay.js        # pen/arrow drawing, 3s fade, click-through toggle
      settings/
        index.html
        settings.js       # camera/mic/system-audio device selection + toggles
    renderer/
      recorder.js         # MediaRecorder + canvas compositing orchestration
      webcam.js            # webcam bubble video element + drag positioning
    lib/
      colorCycle.js        # pure: pen color cycling logic
      cropMath.js           # pure: area-selection rect -> crop params
      ffmpegArgs.js          # pure: builds ffmpeg argument array
      strokeFade.js          # pure: stroke lifetime/fade timing logic
  test/
    colorCycle.test.js
    cropMath.test.js
    ffmpegArgs.test.js
    strokeFade.test.js
  docs/
    superpowers/
      specs/
      plans/
```

**Rationale:** Pure logic (color cycling, crop math, ffmpeg arg building, stroke fade timing) is extracted into `src/lib/*.js` as dependency-free functions — this is what TDD unit tests target. Electron-specific glue (`main/`, `windows/`, `renderer/`) wires those pure functions into IPC/DOM/media APIs and is verified manually (documented in each task) since it requires real OS windows, cameras, and displays.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `src/main/index.js`
- Create: `electron-builder.yml`

**Interfaces:**
- Produces: npm scripts `start` (launches Electron), `test` (runs `node --test test/`), `build` (electron-builder → `.exe` in `dist/`)

- [ ] **Step 1: Init git repo**

Run: `git init`
Expected: `Initialized empty Git repository`

- [ ] **Step 2: Write package.json**

```json
{
  "name": "gravador-de-tela",
  "version": "1.0.0",
  "description": "Gravador de tela simples para tutoriais rapidos",
  "main": "src/main/index.js",
  "scripts": {
    "start": "electron .",
    "test": "node --test test/",
    "build": "electron-builder"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0"
  },
  "dependencies": {
    "ffmpeg-static": "^5.2.0"
  },
  "build": {
    "appId": "com.gravadordetela.app",
    "productName": "Gravador de Tela",
    "win": {
      "target": "portable"
    },
    "files": [
      "src/**/*",
      "package.json"
    ],
    "asarUnpack": [
      "**/node_modules/ffmpeg-static/**"
    ]
  }
}
```

- [ ] **Step 3: Write .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 4: Write minimal main/index.js**

```javascript
const { app, BrowserWindow } = require('electron');

function createToolbarWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 90,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/toolbar/preload.js'),
      contextIsolation: true
    }
  });
  win.loadFile(require('path').join(__dirname, '../windows/toolbar/index.html'));
  return win;
}

app.whenReady().then(() => {
  createToolbarWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
```

- [ ] **Step 5: Write placeholder toolbar files so app boots**

Create `src/windows/toolbar/index.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Gravador de Tela</title></head>
<body>
  <h3>Gravador de Tela — scaffold OK</h3>
</body>
</html>
```

Create empty `src/windows/toolbar/preload.js`:
```javascript
// preload placeholder, filled in Task 2
```

- [ ] **Step 6: Install deps and verify app launches**

Run: `npm install`
Run: `npm start`
Expected: Electron window opens showing "Gravador de Tela — scaffold OK". Close window manually to end process.

- [ ] **Step 7: Write README**

```markdown
# Gravador de Tela

App simples de gravação de tela para tutoriais rápidos. Selecione tela inteira ou uma área, grave, anote com caneta/seta, e exporte em MP4 leve.

## Usar (sem instalar nada)
Baixe o `.exe` mais recente na aba [Releases](../../releases) deste repositório e execute.

## Rodar a partir do código
```
npm install
npm start
```

## Gerar o .exe
```
npm run build
```
O executável fica em `dist/`.
```

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore README.md src/main/index.js src/windows/toolbar/index.html src/windows/toolbar/preload.js electron-builder.yml
git commit -m "chore: scaffold electron app"
```

---

### Task 2: Pure Lib — Pen Color Cycling

**Files:**
- Create: `src/lib/colorCycle.js`
- Test: `test/colorCycle.test.js`

**Interfaces:**
- Produces: `nextColor(current)` → returns next color hex string or `null` (off) in cycle `null → '#000000' → '#0000FF' → '#FF0000' → null`.

- [ ] **Step 1: Write failing test**

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { nextColor } = require('../src/lib/colorCycle');

test('cycles from off to black to blue to red to off', () => {
  assert.strictEqual(nextColor(null), '#000000');
  assert.strictEqual(nextColor('#000000'), '#0000FF');
  assert.strictEqual(nextColor('#0000FF'), '#FF0000');
  assert.strictEqual(nextColor('#FF0000'), null);
});

test('unknown current value resets to off', () => {
  assert.strictEqual(nextColor('#ABCDEF'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/colorCycle.test.js`
Expected: FAIL — Cannot find module `../src/lib/colorCycle`

- [ ] **Step 3: Implement**

```javascript
const CYCLE = [null, '#000000', '#0000FF', '#FF0000'];

function nextColor(current) {
  const idx = CYCLE.indexOf(current);
  if (idx === -1) return null;
  return CYCLE[(idx + 1) % CYCLE.length];
}

module.exports = { nextColor };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/colorCycle.test.js`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorCycle.js test/colorCycle.test.js
git commit -m "feat: add pen color cycling logic"
```

---

### Task 3: Pure Lib — Crop Math for Area Selection

**Files:**
- Create: `src/lib/cropMath.js`
- Test: `test/cropMath.test.js`

**Interfaces:**
- Produces: `toCropParams(selectionRect, sourceSize)` → `{ x, y, width, height }` clamped to source bounds, where `selectionRect = {x, y, width, height}` (can have negative width/height for drag direction) and `sourceSize = {width, height}`.

- [ ] **Step 1: Write failing test**

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { toCropParams } = require('../src/lib/cropMath');

test('normalizes a forward drag rect', () => {
  const result = toCropParams({ x: 10, y: 20, width: 300, height: 200 }, { width: 1920, height: 1080 });
  assert.deepStrictEqual(result, { x: 10, y: 20, width: 300, height: 200 });
});

test('normalizes a reverse drag (negative width/height)', () => {
  const result = toCropParams({ x: 500, y: 400, width: -300, height: -200 }, { width: 1920, height: 1080 });
  assert.deepStrictEqual(result, { x: 200, y: 200, width: 300, height: 200 });
});

test('clamps rect to source bounds', () => {
  const result = toCropParams({ x: -50, y: -30, width: 200, height: 100 }, { width: 1920, height: 1080 });
  assert.deepStrictEqual(result, { x: 0, y: 0, width: 150, height: 70 });
});

test('clamps rect exceeding right/bottom edge', () => {
  const result = toCropParams({ x: 1800, y: 1000, width: 300, height: 200 }, { width: 1920, height: 1080 });
  assert.deepStrictEqual(result, { x: 1800, y: 1000, width: 120, height: 80 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cropMath.test.js`
Expected: FAIL — Cannot find module `../src/lib/cropMath`

- [ ] **Step 3: Implement**

```javascript
function toCropParams(rect, sourceSize) {
  let x = rect.width < 0 ? rect.x + rect.width : rect.x;
  let y = rect.height < 0 ? rect.y + rect.height : rect.y;
  let width = Math.abs(rect.width);
  let height = Math.abs(rect.height);

  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > sourceSize.width) {
    width = sourceSize.width - x;
  }
  if (y + height > sourceSize.height) {
    height = sourceSize.height - y;
  }

  return { x, y, width, height };
}

module.exports = { toCropParams };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cropMath.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/cropMath.js test/cropMath.test.js
git commit -m "feat: add crop math for custom area selection"
```

---

### Task 4: Pure Lib — Stroke Fade Timing

**Files:**
- Create: `src/lib/strokeFade.js`
- Test: `test/strokeFade.test.js`

**Interfaces:**
- Produces: `StrokeStore` class with `.add(stroke, nowMs)`, `.prune(nowMs)` (removes strokes older than 3000ms, returns remaining list), `.all()`.
- `stroke` is an opaque object (e.g. `{ points: [...], color: '#000000' }`); the store only tracks it alongside a timestamp.

- [ ] **Step 1: Write failing test**

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { StrokeStore } = require('../src/lib/strokeFade');

test('keeps strokes younger than 3000ms', () => {
  const store = new StrokeStore();
  store.add({ id: 'a' }, 1000);
  const remaining = store.prune(3500);
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, 'a');
});

test('removes strokes at or older than 3000ms', () => {
  const store = new StrokeStore();
  store.add({ id: 'a' }, 1000);
  const remaining = store.prune(4000);
  assert.strictEqual(remaining.length, 0);
});

test('prunes only expired strokes, keeps fresh ones', () => {
  const store = new StrokeStore();
  store.add({ id: 'old' }, 0);
  store.add({ id: 'new' }, 2000);
  const remaining = store.prune(3100);
  assert.deepStrictEqual(remaining.map(s => s.id), ['new']);
});

test('all() returns current strokes without pruning', () => {
  const store = new StrokeStore();
  store.add({ id: 'a' }, 0);
  assert.strictEqual(store.all().length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/strokeFade.test.js`
Expected: FAIL — Cannot find module `../src/lib/strokeFade`

- [ ] **Step 3: Implement**

```javascript
const FADE_MS = 3000;

class StrokeStore {
  constructor() {
    this._entries = [];
  }

  add(stroke, nowMs) {
    this._entries.push({ stroke, addedAt: nowMs });
  }

  prune(nowMs) {
    this._entries = this._entries.filter(e => nowMs - e.addedAt < FADE_MS);
    return this._entries.map(e => e.stroke);
  }

  all() {
    return this._entries.map(e => e.stroke);
  }
}

module.exports = { StrokeStore, FADE_MS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/strokeFade.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/strokeFade.js test/strokeFade.test.js
git commit -m "feat: add stroke fade timing store"
```

---

### Task 5: Pure Lib — ffmpeg Argument Builder

**Files:**
- Create: `src/lib/ffmpegArgs.js`
- Test: `test/ffmpegArgs.test.js`

**Interfaces:**
- Produces: `buildTranscodeArgs(inputPath, outputPath)` → array of CLI args for ffmpeg per Global Constraints (`-c:v libx264 -crf 23 -preset medium -c:a aac`).

- [ ] **Step 1: Write failing test**

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { buildTranscodeArgs } = require('../src/lib/ffmpegArgs');

test('builds correct ffmpeg args for mp4 transcode', () => {
  const args = buildTranscodeArgs('in.webm', 'out.mp4');
  assert.deepStrictEqual(args, [
    '-i', 'in.webm',
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'medium',
    '-c:a', 'aac',
    'out.mp4'
  ]);
});

test('quotes paths with spaces are passed through unmodified (spawn handles quoting)', () => {
  const args = buildTranscodeArgs('C:/temp/my recording.webm', 'C:/out/final video.mp4');
  assert.strictEqual(args[1], 'C:/temp/my recording.webm');
  assert.strictEqual(args[args.length - 1], 'C:/out/final video.mp4');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ffmpegArgs.test.js`
Expected: FAIL — Cannot find module `../src/lib/ffmpegArgs`

- [ ] **Step 3: Implement**

```javascript
function buildTranscodeArgs(inputPath, outputPath) {
  return [
    '-i', inputPath,
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'medium',
    '-c:a', 'aac',
    outputPath
  ];
}

module.exports = { buildTranscodeArgs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ffmpegArgs.test.js`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/ffmpegArgs.js test/ffmpegArgs.test.js
git commit -m "feat: add ffmpeg transcode argument builder"
```

---

### Task 6: Source Capture — List Screens/Windows

**Files:**
- Create: `src/main/capture.js`
- Modify: `src/main/index.js` (wire IPC handler)
- Create: `src/windows/toolbar/preload.js` (replace placeholder — expose IPC bridge)

**Interfaces:**
- Consumes: Electron `desktopCapturer` (built-in).
- Produces: IPC handler `capture:list-sources` returning `[{ id, name, thumbnailDataUrl }]`; preload exposes `window.gravador.listSources()` returning that promise.

- [ ] **Step 1: Implement capture.js**

```javascript
const { desktopCapturer } = require('electron');

async function listSources() {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: s.thumbnail.toDataURL()
  }));
}

module.exports = { listSources };
```

- [ ] **Step 2: Wire IPC in main/index.js**

Add near top:
```javascript
const { ipcMain } = require('electron');
const { listSources } = require('./capture');
```

Add inside `app.whenReady().then(() => { ... })`, before `createToolbarWindow()`:
```javascript
ipcMain.handle('capture:list-sources', () => listSources());
```

- [ ] **Step 3: Write preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gravador', {
  listSources: () => ipcRenderer.invoke('capture:list-sources')
});
```

- [ ] **Step 4: Manual verification** (no automated test — requires real Electron runtime + real displays)

Run: `npm start`
In DevTools console of toolbar window (Ctrl+Shift+I), run:
```javascript
window.gravador.listSources().then(console.log)
```
Expected: array with at least one entry with `name` matching a screen (e.g. "Screen 1") and a valid `thumbnailDataUrl` starting with `data:image/png`.

- [ ] **Step 5: Commit**

```bash
git add src/main/capture.js src/main/index.js src/windows/toolbar/preload.js
git commit -m "feat: list screen/window sources via desktopCapturer"
```

---

### Task 6b: Custom Area Selection Overlay

**Files:**
- Create: `src/windows/areaselect/index.html`
- Create: `src/windows/areaselect/areaselect.js`
- Create: `src/windows/areaselect/preload.js`
- Modify: `src/main/index.js` (create area-select window on demand, IPC round trip)

**Interfaces:**
- Consumes: `toCropParams(rect, sourceSize)` from Task 3 (`src/lib/cropMath.js`).
- Produces: IPC `areaselect:pick` (invoked from toolbar) → opens fullscreen transparent window, resolves with `{ x, y, width, height }` (already cropped/clamped via `toCropParams`) or `null` if user pressed Escape to cancel.

- [ ] **Step 1: Add area-select window creation + IPC in main/index.js**

```javascript
const { toCropParams } = require('../lib/cropMath');

function createAreaSelectWindow() {
  return new Promise((resolve) => {
    const { screen } = require('electron');
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
      webPreferences: {
        preload: require('path').join(__dirname, '../windows/areaselect/preload.js'),
        contextIsolation: true
      }
    });

    const cleanup = (result) => {
      ipcMain.removeListener('areaselect:result', onResult);
      if (!win.isDestroyed()) win.close();
      resolve(result);
    };
    const onResult = (event, rect) => {
      if (!rect) return cleanup(null);
      const cropped = toCropParams(rect, { width: primary.bounds.width, height: primary.bounds.height });
      cleanup(cropped);
    };

    ipcMain.on('areaselect:result', onResult);
    win.loadFile(require('path').join(__dirname, '../windows/areaselect/index.html'));
  });
}

ipcMain.handle('areaselect:pick', () => createAreaSelectWindow());
```

- [ ] **Step 2: Write areaselect preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('areaSelectBridge', {
  submit: (rect) => ipcRenderer.send('areaselect:result', rect)
});
```

- [ ] **Step 3: Write areaselect/index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    html, body { margin: 0; padding: 0; background: rgba(0,0,0,0.15); overflow: hidden; cursor: crosshair; }
    #rect { position: absolute; border: 2px dashed #4caf50; background: rgba(76,175,80,0.15); display: none; }
    #hint { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); color: #fff; font-family: sans-serif; }
  </style>
</head>
<body>
  <div id="hint">Arraste para selecionar a área. Esc para cancelar.</div>
  <div id="rect"></div>
  <script src="areaselect.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write areaselect.js**

```javascript
const rectEl = document.getElementById('rect');
let startX = 0, startY = 0, dragging = false;

document.addEventListener('mousedown', (e) => {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  rectEl.style.display = 'block';
  rectEl.style.left = startX + 'px';
  rectEl.style.top = startY + 'px';
  rectEl.style.width = '0px';
  rectEl.style.height = '0px';
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const x = Math.min(startX, e.clientX);
  const y = Math.min(startY, e.clientY);
  const width = Math.abs(e.clientX - startX);
  const height = Math.abs(e.clientY - startY);
  rectEl.style.left = x + 'px';
  rectEl.style.top = y + 'px';
  rectEl.style.width = width + 'px';
  rectEl.style.height = height + 'px';
});

document.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  const rect = {
    x: Math.min(startX, e.clientX),
    y: Math.min(startY, e.clientY),
    width: Math.abs(e.clientX - startX),
    height: Math.abs(e.clientY - startY)
  };
  if (rect.width < 5 || rect.height < 5) return;
  window.areaSelectBridge.submit(rect);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.areaSelectBridge.submit(null);
});
```

- [ ] **Step 5: Expose areaselect:pick in toolbar preload.js**

Add to `gravador` bridge in `src/windows/toolbar/preload.js`:
```javascript
pickArea: () => ipcRenderer.invoke('areaselect:pick')
```

- [ ] **Step 6: Manual verification**

Run: `npm start`. In DevTools console of toolbar window, run `window.gravador.pickArea().then(console.log)`. Expected: screen dims slightly, cursor becomes crosshair, dragging shows a green dashed rectangle; releasing mouse resolves the promise with `{x, y, width, height}` clamped to screen bounds. Pressing Escape instead resolves with `null`.

- [ ] **Step 7: Commit**

```bash
git add src/windows/areaselect/ src/main/index.js src/windows/toolbar/preload.js
git commit -m "feat: add custom area selection overlay"
```

---

### Task 7: Toolbar UI — Recording State Machine

**Files:**
- Modify: `src/windows/toolbar/index.html`
- Create: `src/windows/toolbar/toolbar.js`
- Create: `src/windows/toolbar/toolbar.css`
- Test: `test/toolbarState.test.js`
- Create: `src/lib/toolbarState.js` (pure state machine extracted for testability)

**Interfaces:**
- Produces: `createToolbarState()` → object `{ getState(), start(), pause(), resume(), stop(), save(), delete() }` where `getState()` is one of `'idle' | 'recording' | 'paused' | 'preview'`.
- Valid transitions: `idle --start--> recording`, `recording --pause--> paused`, `paused --resume--> recording`, `recording --stop--> preview`, `paused --stop--> preview`, `preview --save--> idle`, `preview --delete--> idle`. Any other call throws `Error('invalid transition')`.

- [ ] **Step 1: Write failing test**

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { createToolbarState } = require('../src/lib/toolbarState');

test('starts idle and moves through full happy path', () => {
  const s = createToolbarState();
  assert.strictEqual(s.getState(), 'idle');
  s.start();
  assert.strictEqual(s.getState(), 'recording');
  s.pause();
  assert.strictEqual(s.getState(), 'paused');
  s.resume();
  assert.strictEqual(s.getState(), 'recording');
  s.stop();
  assert.strictEqual(s.getState(), 'preview');
  s.save();
  assert.strictEqual(s.getState(), 'idle');
});

test('delete from preview returns to idle', () => {
  const s = createToolbarState();
  s.start();
  s.stop();
  s.delete();
  assert.strictEqual(s.getState(), 'idle');
});

test('stop works directly from paused', () => {
  const s = createToolbarState();
  s.start();
  s.pause();
  s.stop();
  assert.strictEqual(s.getState(), 'preview');
});

test('invalid transition throws', () => {
  const s = createToolbarState();
  assert.throws(() => s.pause(), /invalid transition/);
  s.start();
  assert.throws(() => s.save(), /invalid transition/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/toolbarState.test.js`
Expected: FAIL — Cannot find module `../src/lib/toolbarState`

- [ ] **Step 3: Implement state machine**

```javascript
const TRANSITIONS = {
  idle: { start: 'recording' },
  recording: { pause: 'paused', stop: 'preview' },
  paused: { resume: 'recording', stop: 'preview' },
  preview: { save: 'idle', delete: 'idle' }
};

function createToolbarState() {
  let state = 'idle';

  function transition(action) {
    const next = TRANSITIONS[state] && TRANSITIONS[state][action];
    if (!next) throw new Error('invalid transition');
    state = next;
  }

  return {
    getState: () => state,
    start: () => transition('start'),
    pause: () => transition('pause'),
    resume: () => transition('resume'),
    stop: () => transition('stop'),
    save: () => transition('save'),
    delete: () => transition('delete')
  };
}

module.exports = { createToolbarState };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/toolbarState.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Build toolbar UI wiring (manual verification, not unit tested)**

`src/windows/toolbar/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Gravador de Tela</title>
  <link rel="stylesheet" href="toolbar.css">
</head>
<body>
  <div id="controls">
    <button id="btnStart">Iniciar</button>
    <button id="btnPause" disabled>Pausar</button>
    <button id="btnStop" disabled>Parar</button>
    <button id="btnPen">Caneta</button>
    <button id="btnArrow">Seta</button>
    <button id="btnConfig">Config</button>
    <button id="btnSave" style="display:none">Salvar</button>
    <button id="btnDelete" style="display:none">Deletar</button>
  </div>
  <script src="toolbar.js"></script>
</body>
</html>
```

`src/windows/toolbar/toolbar.css`:
```css
body { margin: 0; font-family: sans-serif; background: #222; color: #eee; }
#controls { display: flex; gap: 6px; padding: 10px; }
button { padding: 6px 10px; cursor: pointer; }
button.active { outline: 2px solid #4caf50; }
```

`src/windows/toolbar/toolbar.js` (browser context, uses global `ToolbarStateBrowser` inlined since renderer has no `require` for app code without a bundler — duplicate the tiny state machine inline to avoid build tooling):
```javascript
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

const btnStart = document.getElementById('btnStart');
const btnPause = document.getElementById('btnPause');
const btnStop = document.getElementById('btnStop');
const btnSave = document.getElementById('btnSave');
const btnDelete = document.getElementById('btnDelete');

function render() {
  btnStart.disabled = state !== 'idle';
  btnPause.disabled = state !== 'recording' && state !== 'paused';
  btnPause.textContent = state === 'paused' ? 'Retomar' : 'Pausar';
  btnStop.disabled = state === 'idle' || state === 'preview';
  const inPreview = state === 'preview';
  btnSave.style.display = inPreview ? 'inline-block' : 'none';
  btnDelete.style.display = inPreview ? 'inline-block' : 'none';
}

btnStart.addEventListener('click', () => { transition('start'); render(); });
btnPause.addEventListener('click', () => {
  transition(state === 'paused' ? 'resume' : 'pause');
  render();
});
btnStop.addEventListener('click', () => { transition('stop'); render(); });
btnSave.addEventListener('click', () => { transition('save'); render(); });
btnDelete.addEventListener('click', () => { transition('delete'); render(); });

render();
```

Note: `src/lib/toolbarState.js` stays as the tested source of truth for the transition table; `toolbar.js` inlines the same table because renderer HTML loads scripts without Node's `require` (no bundler in this project, per YAGNI). Keep both tables identical if either changes.

- [ ] **Step 6: Manual verification**

Run: `npm start`. Click Iniciar → Pausar (label becomes Retomar) → Retomar → Parar → confirm Salvar/Deletar buttons appear and Iniciar/Pausar/Parar are hidden-equivalent (disabled). Click Salvar or Deletar → confirm buttons return to initial idle layout.

- [ ] **Step 7: Commit**

```bash
git add src/lib/toolbarState.js test/toolbarState.test.js src/windows/toolbar/
git commit -m "feat: add toolbar recording state machine and UI wiring"
```

---

### Task 8: Draw Overlay Window — Pen and Arrow

**Files:**
- Create: `src/windows/overlay/index.html`
- Create: `src/windows/overlay/overlay.js`
- Modify: `src/main/index.js` (create overlay window, IPC for click-through toggle and tool state)
- Create: `src/windows/overlay/preload.js`

**Interfaces:**
- Consumes: `StrokeStore` pattern from Task 4 (`FADE_MS = 3000`), `nextColor` from Task 2.
- Produces: IPC channels `overlay:set-tool` (`{ tool: 'none'|'pen'|'arrow', color }`) sent from toolbar to main to overlay; overlay calls `ipcRenderer.send('overlay:ready')` on load.

- [ ] **Step 1: Create overlay window in main/index.js**

Add function:
```javascript
let overlayWindow = null;

function createOverlayWindow() {
  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: primary.bounds.width,
    height: primary.bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/overlay/preload.js'),
      contextIsolation: true
    }
  });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(require('path').join(__dirname, '../windows/overlay/index.html'));
  return overlayWindow;
}
```

Call `createOverlayWindow();` inside `app.whenReady().then(...)` alongside toolbar creation.

Add IPC relay:
```javascript
ipcMain.on('overlay:set-tool', (event, payload) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(payload.tool === 'none', { forward: true });
    overlayWindow.webContents.send('overlay:tool-changed', payload);
  }
});
```

- [ ] **Step 2: Write overlay preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayBridge', {
  onToolChanged: (callback) => ipcRenderer.on('overlay:tool-changed', (_e, payload) => callback(payload))
});
```

- [ ] **Step 3: Write overlay/index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="board"></canvas>
  <script src="overlay.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write overlay.js with pen + arrow + 3s fade**

```javascript
const canvas = document.getElementById('board');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext('2d');

const FADE_MS = 3000;
let currentTool = 'none';
let currentColor = '#000000';
let strokes = []; // { type: 'pen'|'arrow', points: [{x,y}], color, addedAt }
let drawing = false;
let activeStroke = null;

window.overlayBridge.onToolChanged(({ tool, color }) => {
  currentTool = tool;
  if (color) currentColor = color;
});

function pointFromEvent(e) {
  return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('mousedown', (e) => {
  if (currentTool === 'none') return;
  drawing = true;
  activeStroke = { type: currentTool, points: [pointFromEvent(e)], color: currentColor, addedAt: Date.now() };
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing || !activeStroke) return;
  if (currentTool === 'pen') {
    activeStroke.points.push(pointFromEvent(e));
  } else if (currentTool === 'arrow') {
    activeStroke.points[1] = pointFromEvent(e);
  }
});

window.addEventListener('mouseup', () => {
  if (drawing && activeStroke) {
    strokes.push(activeStroke);
    activeStroke = null;
  }
  drawing = false;
});

function drawArrowHead(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = 18;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function render() {
  const now = Date.now();
  strokes = strokes.filter(s => now - s.addedAt < FADE_MS);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const all = activeStroke ? [...strokes, activeStroke] : strokes;
  for (const stroke of all) {
    if (stroke.points.length < 2) continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    if (stroke.type === 'pen') {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (stroke.type === 'arrow') {
      const [from, to] = stroke.points;
      if (!to) continue;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      drawArrowHead(from, to);
    }
  }
  requestAnimationFrame(render);
}
render();
```

Note: fade/prune logic here duplicates `src/lib/strokeFade.js`'s timing rule (3000ms) inline for the same no-bundler reason as Task 7 — `StrokeStore` remains the tested reference for that rule.

- [ ] **Step 5: Wire toolbar pen/arrow buttons to send overlay:set-tool**

Modify `src/windows/toolbar/preload.js` (extend, don't replace Task 6's bridge):
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gravador', {
  listSources: () => ipcRenderer.invoke('capture:list-sources'),
  setOverlayTool: (payload) => ipcRenderer.send('overlay:set-tool', payload)
});
```

Modify `src/windows/toolbar/toolbar.js` — add after existing button wiring:
```javascript
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
const btnPen = document.getElementById('btnPen');
const btnArrow = document.getElementById('btnArrow');

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
```

- [ ] **Step 6: Manual verification**

Run: `npm start`. Click Caneta once → cursor draws black strokes over entire screen (test by dragging mouse over overlay area) that fade after ~3s. Click Caneta again → blue; again → red; again → off (overlay becomes click-through, clicks pass to apps underneath — verify by clicking a taskbar icon through the overlay). Click Seta → drag draws a line with arrowhead pointing at drag end, fades after 3s.

- [ ] **Step 7: Commit**

```bash
git add src/windows/overlay/ src/windows/toolbar/preload.js src/windows/toolbar/toolbar.js src/main/index.js
git commit -m "feat: add draw overlay with pen and arrow tools"
```

---

### Task 9: Settings Window — Camera, Mic, System Audio

**Files:**
- Create: `src/windows/settings/index.html`
- Create: `src/windows/settings/settings.js`
- Create: `src/windows/settings/preload.js`
- Modify: `src/main/index.js` (open settings window, store settings in memory, IPC to broadcast changes)

**Interfaces:**
- Produces: IPC `settings:get` / `settings:update` returning/accepting `{ cameraId, micEnabled, micId, systemAudioEnabled }`; broadcasts `settings:changed` to toolbar/recorder renderer.

- [ ] **Step 1: Add settings state + IPC to main/index.js**

```javascript
let appSettings = {
  cameraId: null,
  micEnabled: true,
  micId: null,
  systemAudioEnabled: true
};
let settingsWindow = null;

function createSettingsWindow() {
  if (settingsWindow) { settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 360,
    height: 320,
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/settings/preload.js'),
      contextIsolation: true
    }
  });
  settingsWindow.loadFile(require('path').join(__dirname, '../windows/settings/index.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

ipcMain.handle('settings:get', () => appSettings);
ipcMain.on('settings:update', (event, newSettings) => {
  appSettings = { ...appSettings, ...newSettings };
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('settings:changed', appSettings));
});
ipcMain.on('open-settings', () => createSettingsWindow());
```

- [ ] **Step 2: Write settings preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsBridge', {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (settings) => ipcRenderer.send('settings:update', settings)
});
```

- [ ] **Step 3: Write settings/index.html**

```html
<!DOCTYPE html>
<html>
<head><title>Configurações</title></head>
<body>
  <h4>Câmera</h4>
  <select id="cameraSelect"></select>

  <h4>Microfone</h4>
  <label><input type="checkbox" id="micToggle"> Ativar microfone</label>
  <select id="micSelect"></select>

  <h4>Áudio do sistema</h4>
  <label><input type="checkbox" id="sysAudioToggle"> Capturar áudio do sistema</label>

  <script src="settings.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write settings.js**

```javascript
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const micToggle = document.getElementById('micToggle');
const sysAudioToggle = document.getElementById('sysAudioToggle');

async function populateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  for (const d of devices.filter(d => d.kind === 'videoinput')) {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || 'Câmera';
    cameraSelect.appendChild(opt);
  }
  for (const d of devices.filter(d => d.kind === 'audioinput')) {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || 'Microfone';
    micSelect.appendChild(opt);
  }
}

async function init() {
  await populateDevices();
  const current = await window.settingsBridge.get();
  if (current.cameraId) cameraSelect.value = current.cameraId;
  if (current.micId) micSelect.value = current.micId;
  micToggle.checked = current.micEnabled;
  sysAudioToggle.checked = current.systemAudioEnabled;
}

function pushUpdate() {
  window.settingsBridge.update({
    cameraId: cameraSelect.value,
    micId: micSelect.value,
    micEnabled: micToggle.checked,
    systemAudioEnabled: sysAudioToggle.checked
  });
}

cameraSelect.addEventListener('change', pushUpdate);
micSelect.addEventListener('change', pushUpdate);
micToggle.addEventListener('change', pushUpdate);
sysAudioToggle.addEventListener('change', pushUpdate);

init();
```

- [ ] **Step 5: Wire toolbar Config button**

Modify `src/windows/toolbar/preload.js` — add:
```javascript
openSettings: () => ipcRenderer.send('open-settings')
```
(inside the existing `contextBridge.exposeInMainWorld('gravador', { ... })` object)

Modify `src/windows/toolbar/toolbar.js` — add:
```javascript
document.getElementById('btnConfig').addEventListener('click', () => {
  window.gravador.openSettings();
});
```

- [ ] **Step 6: Manual verification**

Run: `npm start`. Click Config → settings window opens, camera/mic dropdowns populate with real device names (grant permission if prompted), toggling checkboxes doesn't error (check DevTools console). Close and reopen — confirm last-selected values persist (in-memory for the session).

- [ ] **Step 7: Commit**

```bash
git add src/windows/settings/ src/main/index.js src/windows/toolbar/preload.js src/windows/toolbar/toolbar.js
git commit -m "feat: add settings window for camera/mic/system audio"
```

---

### Task 10: Webcam Bubble

**Files:**
- Create: `src/renderer/webcam.js`
- Modify: `src/windows/toolbar/index.html` (add webcam bubble as a separate always-on-top overlay is more correct, but simplest correct approach: reuse overlay window since it's already fullscreen+transparent+always-on-top — add a `<video>` element positioned there instead of a 3rd window)
- Modify: `src/windows/overlay/index.html`, `src/windows/overlay/overlay.js`

**Interfaces:**
- Consumes: `settings:changed` IPC (Task 9) for `cameraId`.
- Produces: draggable circular `<video>` bubble bottom-right default, visible through the overlay window (overlay stays click-through outside the bubble; bubble itself must accept drag).

- [ ] **Step 1: Add webcam bubble markup to overlay/index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    canvas { display: block; position: absolute; top: 0; left: 0; }
    #webcamBubble {
      position: absolute;
      width: 160px;
      height: 160px;
      border-radius: 50%;
      overflow: hidden;
      right: 24px;
      bottom: 24px;
      cursor: move;
      display: none;
      border: 2px solid rgba(255,255,255,0.8);
    }
    #webcamBubble video { width: 100%; height: 100%; object-fit: cover; }
  </style>
</head>
<body>
  <canvas id="board"></canvas>
  <div id="webcamBubble"><video id="webcamVideo" autoplay muted></video></div>
  <script src="overlay.js"></script>
  <script src="../../renderer/webcam.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write renderer/webcam.js**

```javascript
(function () {
  const bubble = document.getElementById('webcamBubble');
  const video = document.getElementById('webcamVideo');
  let stream = null;

  async function startCamera(deviceId) {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true
      });
      video.srcObject = stream;
      bubble.style.display = 'block';
    } catch (err) {
      bubble.style.display = 'none';
      console.error('Camera unavailable:', err.message);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    bubble.style.display = 'none';
  }

  let dragging = false, offsetX = 0, offsetY = 0;
  bubble.addEventListener('mousedown', (e) => {
    dragging = true;
    offsetX = e.clientX - bubble.offsetLeft;
    offsetY = e.clientY - bubble.offsetTop;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    bubble.style.left = (e.clientX - offsetX) + 'px';
    bubble.style.top = (e.clientY - offsetY) + 'px';
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  window.overlayBridge.onSettingsChanged((settings) => {
    if (settings.cameraId) startCamera(settings.cameraId);
    else stopCamera();
  });

  window.overlayBridge.getSettings().then((settings) => {
    if (settings.cameraId) startCamera(settings.cameraId);
  });
})();
```

- [ ] **Step 3: Extend overlay preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayBridge', {
  onToolChanged: (callback) => ipcRenderer.on('overlay:tool-changed', (_e, payload) => callback(payload)),
  onSettingsChanged: (callback) => ipcRenderer.on('settings:changed', (_e, payload) => callback(payload)),
  getSettings: () => ipcRenderer.invoke('settings:get')
});
```

- [ ] **Step 4: Make overlay bubble draggable despite click-through window**

The overlay `BrowserWindow` uses `setIgnoreMouseEvents(true, {forward:true})` by default (Task 8), which makes the whole window click-through, including the bubble. Modify `overlay.js` to toggle mouse events based on cursor position over the bubble:

Add to `overlay.js` (top-level, alongside existing code):
```javascript
const bubbleEl = document.getElementById('webcamBubble');
document.addEventListener('mousemove', (e) => {
  if (currentTool !== 'none') return;
  const rect = bubbleEl.getBoundingClientRect();
  const overBubble = e.clientX >= rect.left && e.clientX <= rect.right &&
                      e.clientY >= rect.top && e.clientY <= rect.bottom;
  window.overlayBridge.setIgnoreMouse(!overBubble);
});
```

Add to overlay preload.js:
```javascript
setIgnoreMouse: (ignore) => ipcRenderer.send('overlay:set-ignore-mouse', ignore)
```

Add to main/index.js:
```javascript
ipcMain.on('overlay:set-ignore-mouse', (event, ignore) => {
  if (overlayWindow) overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
});
```

- [ ] **Step 5: Manual verification**

Run: `npm start`. Open Config, pick a camera → webcam bubble appears bottom-right on the overlay. Hover over bubble → cursor can drag it to a new position; move mouse off bubble → clicks pass through to apps underneath again. Toggle camera off in settings (select blank) → bubble disappears.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/webcam.js src/windows/overlay/
git commit -m "feat: add draggable webcam bubble overlay"
```

---

### Task 11: Recording — Compositing Canvas + MediaRecorder

**Files:**
- Create: `src/renderer/recorder.js`
- Modify: `src/windows/toolbar/index.html` (hidden compositing canvas + video elements)
- Modify: `src/windows/toolbar/toolbar.js` (wire Start/Pause/Stop to recorder)
- Modify: `src/main/index.js` (IPC to fetch selected source + area, pass to recorder)

**Interfaces:**
- Consumes: `createToolbarState()` (Task 7), `window.gravador.listSources()` (Task 6), `settingsBridge`-equivalent settings via `gravador.getSettings()` (extend bridge).
- Produces: `window.recorderApi = { start(sourceId, cropRect), pause(), resume(), stop(): Promise<Blob> }` attached in `recorder.js`, called from `toolbar.js`.

- [ ] **Step 1: Extend toolbar preload.js to expose settings read + source list already present**

Add to `gravador` bridge object in `src/windows/toolbar/preload.js`:
```javascript
getSettings: () => ipcRenderer.invoke('settings:get')
```

- [ ] **Step 2: Add hidden canvas/video elements to toolbar/index.html**

Add before `<script src="toolbar.js">`:
```html
<canvas id="compositeCanvas" style="display:none"></canvas>
<video id="screenVideo" style="display:none" autoplay muted></video>
<script src="../../renderer/recorder.js"></script>
```

- [ ] **Step 3: Write renderer/recorder.js**

```javascript
window.recorderApi = (function () {
  const canvas = document.getElementById('compositeCanvas');
  const screenVideo = document.getElementById('screenVideo');
  const ctx = canvas.getContext('2d');

  let mediaRecorder = null;
  let recordedChunks = [];
  let rafId = null;
  let cropRect = null;
  let screenStream = null;
  let micStream = null;

  function drawFrame() {
    if (cropRect) {
      ctx.drawImage(screenVideo, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
    }
    rafId = requestAnimationFrame(drawFrame);
  }

  async function start(sourceId, rect) {
    recordedChunks = [];
    cropRect = rect || null;

    const settingsData = await window.gravador.getSettings();

    screenStream = await navigator.mediaDevices.getUserMedia({
      audio: settingsData.systemAudioEnabled
        ? { mandatory: { chromeMediaSource: 'desktop' } }
        : false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId
        }
      }
    });
    screenVideo.srcObject = screenStream;
    await screenVideo.play();

    const track = screenStream.getVideoTracks()[0];
    const settings = track.getSettings();
    canvas.width = rect ? rect.width : settings.width;
    canvas.height = rect ? rect.height : settings.height;

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    let hasAudio = false;

    if (settingsData.systemAudioEnabled && screenStream.getAudioTracks().length > 0) {
      audioContext.createMediaStreamSource(new MediaStream(screenStream.getAudioTracks())).connect(destination);
      hasAudio = true;
    }

    if (settingsData.micEnabled) {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: settingsData.micId ? { deviceId: { exact: settingsData.micId } } : true
      });
      audioContext.createMediaStreamSource(micStream).connect(destination);
      hasAudio = true;
    }

    const canvasStream = canvas.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks()];
    if (hasAudio) tracks.push(...destination.stream.getAudioTracks());

    const combined = new MediaStream(tracks);
    mediaRecorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp9,opus' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    drawFrame();
    mediaRecorder.start();
  }

  function pause() {
    mediaRecorder.pause();
  }

  function resume() {
    mediaRecorder.resume();
  }

  function stop() {
    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        cancelAnimationFrame(rafId);
        screenStream.getTracks().forEach(t => t.stop());
        if (micStream) micStream.getTracks().forEach(t => t.stop());
        resolve(new Blob(recordedChunks, { type: 'video/webm' }));
      };
      mediaRecorder.stop();
    });
  }

  return { start, pause, resume, stop };
})();
```

- [ ] **Step 4: Wire toolbar.js Start/Pause/Stop to recorderApi + source picking**

Replace the button event listeners block from Task 7 with (state machine calls now trigger real recording):
```javascript
btnStart.addEventListener('click', async () => {
  const sources = await window.gravador.listSources();
  const screenSource = sources.find(s => s.name.toLowerCase().includes('screen')) || sources[0];
  if (!screenSource) {
    alert('Nenhuma tela encontrada para gravar.');
    return;
  }
  const useArea = confirm('Gravar área customizada? Cancelar = tela inteira.');
  const cropRect = useArea ? await window.gravador.pickArea() : null;
  if (useArea && !cropRect) return; // user pressed Escape in area picker

  await window.recorderApi.start(screenSource.id, cropRect);
  transition('start');
  render();
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

let lastRecordingBlob = null;
btnStop.addEventListener('click', async () => {
  lastRecordingBlob = await window.recorderApi.stop();
  transition('stop');
  render();
});
```

Add to `gravador` bridge in `src/windows/toolbar/preload.js` (if not already added in Task 6b):
```javascript
pickArea: () => ipcRenderer.invoke('areaselect:pick')
```

- [ ] **Step 5: Manual verification**

Run: `npm start`. Click Iniciar → confirm dialog asks full screen vs custom area. Test full screen: click Cancelar on the area prompt → grant screen-capture permission prompt if shown → confirm recording starts (no errors in DevTools console). Click Pausar → Retomar → Parar. Confirm `lastRecordingBlob` in toolbar.js scope is a non-empty Blob (check via DevTools: temporarily `console.log(lastRecordingBlob.size)` after stop — should be > 0). Then repeat clicking OK on the area prompt, drag a region in the area picker, and confirm the resulting recording is cropped to that region (canvas dimensions match the dragged rect).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/recorder.js src/windows/toolbar/
git commit -m "feat: implement screen capture recording with canvas compositing"
```

---

### Task 12: Export — WebM to MP4 via ffmpeg

**Files:**
- Create: `src/main/export.js`
- Modify: `src/main/index.js` (IPC `export:save`)
- Modify: `src/windows/toolbar/toolbar.js` (wire Salvar/Deletar buttons to real blob handling)
- Modify: `src/windows/toolbar/preload.js` (expose `saveRecording`)

**Interfaces:**
- Consumes: `buildTranscodeArgs` (Task 5), `lastRecordingBlob` (Task 11).
- Produces: `saveRecording(webmArrayBuffer)` IPC round-trip that writes temp WebM, transcodes to MP4, opens save dialog, returns `{ success, path, fallback: 'webm'|'mp4' }`.

- [ ] **Step 1: Implement export.js**

```javascript
const { dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const { buildTranscodeArgs } = require('../lib/ffmpegArgs');

async function transcodeToMp4(webmPath, mp4Path) {
  return new Promise((resolve, reject) => {
    const args = buildTranscodeArgs(webmPath, mp4Path);
    const proc = spawn(ffmpegPath, args);
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function saveRecording(buffer, browserWindow) {
  const tempWebm = path.join(os.tmpdir(), `gravacao-${Date.now()}.webm`);
  fs.writeFileSync(tempWebm, buffer);

  const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
    title: 'Salvar gravação',
    defaultPath: `tutorial-${Date.now()}.mp4`,
    filters: [{ name: 'Vídeo MP4', extensions: ['mp4'] }]
  });

  if (canceled || !filePath) {
    fs.unlinkSync(tempWebm);
    return { success: false };
  }

  try {
    await transcodeToMp4(tempWebm, filePath);
    fs.unlinkSync(tempWebm);
    return { success: true, path: filePath, format: 'mp4' };
  } catch (err) {
    const fallbackPath = filePath.replace(/\.mp4$/, '.webm');
    fs.renameSync(tempWebm, fallbackPath);
    return { success: true, path: fallbackPath, format: 'webm', warning: err.message };
  }
}

module.exports = { saveRecording, transcodeToMp4 };
```

- [ ] **Step 2: Wire IPC in main/index.js**

```javascript
const { saveRecording } = require('./export');

ipcMain.handle('export:save', async (event, arrayBuffer) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return saveRecording(Buffer.from(arrayBuffer), win);
});
```

- [ ] **Step 3: Expose in toolbar preload.js**

Add to `gravador` bridge:
```javascript
saveRecording: (arrayBuffer) => ipcRenderer.invoke('export:save', arrayBuffer)
```

- [ ] **Step 4: Wire Salvar/Deletar buttons in toolbar.js**

Replace the existing `btnSave`/`btnDelete` listeners from Task 7 with:
```javascript
btnSave.addEventListener('click', async () => {
  if (!lastRecordingBlob) return;
  const arrayBuffer = await lastRecordingBlob.arrayBuffer();
  const result = await window.gravador.saveRecording(arrayBuffer);
  if (result.success) {
    if (result.format === 'webm') {
      alert('Não foi possível converter para MP4, salvo como WebM: ' + result.path);
    }
    lastRecordingBlob = null;
    transition('save');
    render();
  }
});

btnDelete.addEventListener('click', () => {
  lastRecordingBlob = null;
  transition('delete');
  render();
});
```

- [ ] **Step 5: Manual verification**

Run: `npm start`. Record a few seconds, Parar, click Salvar, choose destination in dialog → confirm an `.mp4` file is created and playable (open in a video player), with audio if mic was enabled, and file size reasonable (few MB for a short clip, not tens of MB). Repeat but click Deletar instead → confirm no file is written and app returns to idle.

To verify the ffmpeg failure fallback path specifically: temporarily rename/break `ffmpegPath` (e.g., point to a nonexistent path) and confirm a `.webm` file is saved instead with the warning alert shown, then restore the correct path.

- [ ] **Step 6: Commit**

```bash
git add src/main/export.js src/main/index.js src/windows/toolbar/toolbar.js src/windows/toolbar/preload.js
git commit -m "feat: export recording to mp4 via ffmpeg with webm fallback"
```

---

### Task 13: Close-During-Recording Guard

**Files:**
- Modify: `src/main/index.js` (before-quit / close confirmation)
- Modify: `src/windows/toolbar/toolbar.js` (expose current state to main for the guard)

**Interfaces:**
- Consumes: `createToolbarState()` state (`'recording' | 'paused'` = at risk).
- Produces: IPC `recording:state-changed` sent from toolbar whenever state changes; main tracks last known state and blocks window close with a native confirm dialog if it's `'recording'` or `'paused'`.

- [ ] **Step 1: Send state to main on every transition in toolbar.js**

Modify the `render()` function to also notify main:
```javascript
function render() {
  btnStart.disabled = state !== 'idle';
  btnPause.disabled = state !== 'recording' && state !== 'paused';
  btnPause.textContent = state === 'paused' ? 'Retomar' : 'Pausar';
  btnStop.disabled = state === 'idle' || state === 'preview';
  const inPreview = state === 'preview';
  btnSave.style.display = inPreview ? 'inline-block' : 'none';
  btnDelete.style.display = inPreview ? 'inline-block' : 'none';
  window.gravador.notifyState(state);
}
```

- [ ] **Step 2: Expose notifyState in preload.js**

Add to `gravador` bridge:
```javascript
notifyState: (state) => ipcRenderer.send('recording:state-changed', state)
```

- [ ] **Step 3: Track state and guard close in main/index.js**

```javascript
let currentRecordingState = 'idle';
ipcMain.on('recording:state-changed', (event, state) => {
  currentRecordingState = state;
});

let toolbarWindow = null; // ensure createToolbarWindow() assigns to this instead of a local var

app.on('before-quit', (event) => {
  if (currentRecordingState === 'recording' || currentRecordingState === 'paused') {
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Cancelar', 'Sair mesmo assim'],
      defaultId: 0,
      title: 'Gravação em andamento',
      message: 'Você tem uma gravação em andamento que será perdida. Sair mesmo assim?'
    });
    if (choice === 0) {
      event.preventDefault();
    }
  }
});
```

Add `const { dialog } = require('electron');` to the top requires if not already present (it is, from Task 12's export usage in the same process — confirm import exists once at top of file rather than duplicated).

- [ ] **Step 4: Manual verification**

Run: `npm start`. Start a recording, then try to close the app window (Alt+F4 or window X button). Expected: confirmation dialog appears. Choose "Cancelar" → app stays open. Try again, choose "Sair mesmo assim" → app closes. Repeat while idle (not recording) → app closes immediately with no dialog.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.js src/windows/toolbar/toolbar.js src/windows/toolbar/preload.js
git commit -m "feat: warn before quitting during an active recording"
```

---

### Task 14: Packaging and GitHub Release Readiness

**Files:**
- Modify: `package.json` (confirm build config complete, from Task 1)
- Modify: `README.md` (finalize usage instructions)
- Create: `.github/workflows/release.yml` (optional but requested distribution flow — build .exe on tag push)

**Interfaces:**
- Produces: `dist/Gravador de Tela.exe` (portable) when running `npm run build` locally.

- [ ] **Step 1: Verify electron-builder config targets portable exe**

Confirm `package.json`'s `build.win.target` is `"portable"` (set in Task 1) — this produces a single `.exe` with no installer, matching "sem firula" requirement.

- [ ] **Step 2: Run local build**

Run: `npm run build`
Expected: `dist/Gravador de Tela 1.0.0.exe` (or similar name) created without errors.

- [ ] **Step 3: Manual verification of packaged exe**

Double-click the generated `.exe` from `dist/`. Expected: app launches identically to `npm start` — toolbar appears, recording/pen/arrow/webcam/settings/export all function per prior tasks' manual verifications.

- [ ] **Step 4: Add GitHub Actions release workflow**

```yaml
name: Build and Release
on:
  push:
    tags:
      - 'v*'
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/*.exe
```

- [ ] **Step 5: Finalize README with release instructions**

Update README.md's "Usar (sem instalar nada)" section (from Task 1) to confirm it points at `../../releases` — already correct from Task 1, no change needed unless wording requires updating after real testing. Add a short "Como funciona" section summarizing controls:

```markdown
## Controles
- **Iniciar / Pausar / Parar**: controla a gravação.
- **Caneta**: clique para alternar preto → azul → vermelho → desligado. Desenha por cima da tela, some sozinho após 3s.
- **Seta**: liga/desliga modo de apontar com seta (mesmo fade de 3s).
- **Config**: escolhe câmera, liga/desliga microfone e áudio do sistema.
- **Salvar / Deletar**: após parar, decide se exporta em MP4 ou descarta a gravação.
```

- [ ] **Step 6: Commit**

```bash
git add package.json README.md .github/workflows/release.yml
git commit -m "chore: finalize packaging and add release workflow"
```

- [ ] **Step 7: Push and tag for first release (only if user confirms GitHub remote is ready)**

This step requires a GitHub remote the user has created — confirm with user before running:
```bash
git remote add origin <user-provided-url>
git push -u origin main
git tag v1.0.0
git push origin v1.0.0
```

---

## Self-Review Notes

- **Spec coverage:** full-screen selection (Task 6) and custom area selection (Task 6b, wired into Task 11's Start button) both covered. Start/pause/stop (Task 7, 11). Delete (Task 7, 12). Pen 3 colors (Task 2, 8). Arrow (Task 8). Camera config (Task 9). Audio config — mic (Task 9, 11) and system audio (Task 9, 11 — screen `getUserMedia` requests desktop audio and mixes it into the same `AudioContext` destination as mic). MP4 light+quality export (Task 5, 12). GitHub distribution as ready exe (Task 14).
- **Type consistency check:** `nextColor` signature `(current) → string|null` used identically in Task 2 lib and Task 8's inlined toolbar copy. `StrokeStore`/`FADE_MS` from Task 4 conceptually mirrored (not imported) in Task 8's `overlay.js` — both use 3000ms literal, consistent. `createToolbarState()` transition table matches the inlined copy in Task 7's `toolbar.js` exactly. `buildTranscodeArgs(inputPath, outputPath)` signature used consistently in Task 5 and Task 12. `toCropParams(rect, sourceSize)` from Task 3 consumed as-is inside Task 6b's main-process IPC handler; its output `{x,y,width,height}` matches the shape Task 11's `recorder.js` `start(sourceId, rect)` already expects.
- **Placeholder scan:** none found — every step has concrete code or an explicit manual-verification procedure.
