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

document.getElementById('btnConfig').addEventListener('click', () => {
  window.gravador.openSettings();
});
