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
    try {
      if (cropRect) {
        ctx.drawImage(screenVideo, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
      }
    } catch (err) {
      // An exception here (e.g. transient zero-size source rect) would otherwise
      // kill the rAF loop silently, leaving the recording with no video frames.
      console.error('drawFrame failed, skipping this frame:', err);
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

  function teardown() {
    cancelAnimationFrame(rafId);
    rafId = null;
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (audioContext) { audioContext.close(); audioContext = null; }
    screenStream = null;
    micStream = null;
  }

  function stop() {
    return new Promise((resolve, reject) => {
      mediaRecorder.onstop = () => {
        teardown();
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        if (blob.size === 0) {
          reject(new Error('A gravação não capturou nenhum dado de vídeo.'));
          return;
        }
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  }

  // Aborts the recording and drops the captured data. Unlike stop(), it never
  // produces a Blob — the chunks are discarded before onstop can assemble them.
  function cancel() {
    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        recordedChunks = [];
        teardown();
        resolve();
      };
      if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      else { teardown(); resolve(); }
    });
  }

  return { start, pause, resume, stop, cancel };
})();
