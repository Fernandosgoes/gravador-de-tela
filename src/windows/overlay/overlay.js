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

const bubbleEl = document.getElementById('webcamBubble');
document.addEventListener('mousemove', (e) => {
  if (currentTool !== 'none') return;
  const rect = bubbleEl.getBoundingClientRect();
  const overBubble = e.clientX >= rect.left && e.clientX <= rect.right &&
                      e.clientY >= rect.top && e.clientY <= rect.bottom;
  window.overlayBridge.setIgnoreMouse(!overBubble);
});
