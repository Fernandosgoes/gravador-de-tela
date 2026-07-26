const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const micToggle = document.getElementById('micToggle');
const sysAudioToggle = document.getElementById('sysAudioToggle');

async function populateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'Nenhuma câmera';
  cameraSelect.appendChild(noneOpt);
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
