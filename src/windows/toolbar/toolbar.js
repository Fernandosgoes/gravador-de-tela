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
