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
  let audioContext = null;

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

    audioContext = new AudioContext();
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
        if (audioContext) { audioContext.close(); audioContext = null; }
        resolve(new Blob(recordedChunks, { type: 'video/webm' }));
      };
      mediaRecorder.stop();
    });
  }

  return { start, pause, resume, stop };
})();
