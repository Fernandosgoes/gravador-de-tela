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
