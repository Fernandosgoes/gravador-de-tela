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

// Pen/Arrow overlay tool wiring — nextColor cycle inlined (mirrors src/lib/colorCycle.js)
// because the renderer has no require() without a bundler; see Task 7 note above.
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
