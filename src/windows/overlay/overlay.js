const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// Sizing the canvas' drawing-buffer attributes from window.innerWidth/Height
// at script-load time could race the window's own layout — if it ran before
// the fullscreen bounds settled, the canvas element stayed smaller than the
// real window forever after. Clicks landing in that leftover strip fell
// through to <body> instead of the canvas (confirmed: mousedown fired on
// document but never on the canvas there), silently refusing to draw in
// exactly that band. Resizing on both load and window 'resize' keeps the
// buffer's pixel dimensions matched to the actual viewport at all times.
function syncCanvasSize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
syncCanvasSize();
window.addEventListener('resize', syncCanvasSize);

const FADE_MS = 6000;
let currentTool = 'none';
let currentColor = '#000000';
let strokes = []; // { type: 'pen'|'arrow'|'rect', points: [{x,y}], color, addedAt }
let drawing = false;
let activeStroke = null;
let rendering = false;

// The render loop only runs while there's something to draw (active tool, a
// stroke in progress, or strokes still fading out) — otherwise this fullscreen
// transparent window would keep compositing at 60fps for the entire lifetime
// of the app, most of which has nothing on screen to show.
function ensureRendering() {
  if (rendering) return;
  rendering = true;
  render();
}

window.overlayBridge.onToolChanged(({ tool, color }) => {
  currentTool = tool;
  if (color) currentColor = color;
});

// Set once per recording (null in fullscreen mode) — confines drawing to the
// area actually being captured, so strokes can't land outside the recorded
// region and end up invisible in the exported video.
let areaRect = null;
window.overlayBridge.onAreaSet((rect) => { areaRect = rect; });

function pointFromEvent(e) {
  return { x: e.clientX, y: e.clientY };
}

function insideArea(p) {
  if (!areaRect) return true;
  return p.x >= areaRect.x && p.x <= areaRect.x + areaRect.width &&
         p.y >= areaRect.y && p.y <= areaRect.y + areaRect.height;
}

canvas.addEventListener('mousedown', (e) => {
  if (currentTool === 'none') return;
  const p = pointFromEvent(e);
  if (!insideArea(p)) return;
  drawing = true;
  activeStroke = { type: currentTool, points: [p], color: currentColor, addedAt: Date.now() };
  ensureRendering();
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing || !activeStroke) return;
  // Clamp to the area's edges rather than dropping the point — lets the user
  // drag right up to the boundary without the stroke stopping short or
  // needing pixel-perfect precision.
  const raw = pointFromEvent(e);
  const p = areaRect ? {
    x: Math.min(Math.max(raw.x, areaRect.x), areaRect.x + areaRect.width),
    y: Math.min(Math.max(raw.y, areaRect.y), areaRect.y + areaRect.height)
  } : raw;
  if (currentTool === 'pen') {
    activeStroke.points.push(p);
  } else if (currentTool === 'arrow' || currentTool === 'rect') {
    // Both are two-point shapes: [anchor, current cursor].
    activeStroke.points[1] = p;
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
    } else if (stroke.type === 'rect') {
      const [from, to] = stroke.points;
      if (!to) continue;
      // Outline only — never fill, so the rectangle never hides screen content.
      ctx.lineJoin = 'miter';
      ctx.strokeRect(
        Math.min(from.x, to.x), Math.min(from.y, to.y),
        Math.abs(to.x - from.x), Math.abs(to.y - from.y)
      );
      ctx.lineJoin = 'round';
    }
  }

  // Nothing left to animate (no strokes still fading, nothing being drawn
  // right now) — stop rescheduling. Having a tool armed is not by itself a
  // reason to keep animating: a tool sitting idle with nothing on screen was
  // still repainting at 60fps forever, which fought the toolbar's drag
  // polling (main-process setInterval) for the compositor and made dragging
  // the toolbar stutter badly whenever a tool was active. mousedown/mousemove
  // below call ensureRendering() again the moment drawing actually starts.
  if (strokes.length === 0 && !activeStroke) {
    rendering = false;
    return;
  }
  requestAnimationFrame(render);
}

const bubbleEl = document.getElementById('webcamBubble');
document.addEventListener('mousemove', (e) => {
  if (currentTool !== 'none') return;
  const rect = bubbleEl.getBoundingClientRect();
  const overBubble = e.clientX >= rect.left && e.clientX <= rect.right &&
                      e.clientY >= rect.top && e.clientY <= rect.bottom;
  window.overlayBridge.setIgnoreMouse(!overBubble);
});
