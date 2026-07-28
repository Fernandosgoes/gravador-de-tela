const rectEl = document.getElementById('rect');
const dimLabel = document.getElementById('dimLabel');
const actions = document.getElementById('actions');
const startBtn = document.getElementById('startBtn');
const cancelBtn = document.getElementById('cancelBtn');
const cancelTopBtn = document.getElementById('cancelTopBtn');
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
  actions.classList.add('visible');
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
    const newHeight = bottom - e.clientY;
    if (newHeight >= 10) {
      rect.height = newHeight;
      rect.y = e.clientY;
    } else {
      rect.height = 10;
      rect.y = bottom - 10;
    }
  }
  if (activeHandle.includes('s')) {
    rect.height = e.clientY - rect.y;
  }
  if (activeHandle.includes('w')) {
    const newWidth = right - e.clientX;
    if (newWidth >= 10) {
      rect.width = newWidth;
      rect.x = e.clientX;
    } else {
      rect.width = 10;
      rect.x = right - 10;
    }
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
  if (e.target.classList.contains('handle') || e.target.closest('#actions')) return;
  movingRect = true;
  moveOffsetX = e.clientX - rect.x;
  moveOffsetY = e.clientY - rect.y;
});

// ---- Confirm / cancel ----
startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.areaSelectBridge.submit({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
});

function cancel(e) {
  if (e) e.stopPropagation();
  window.areaSelectBridge.submit(null);
}
cancelBtn.addEventListener('click', cancel);
// mousedown must not reach the document-level listener, or it would start a
// draw gesture underneath this always-visible button.
cancelTopBtn.addEventListener('mousedown', (e) => e.stopPropagation());
cancelTopBtn.addEventListener('click', cancel);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cancel();
});
