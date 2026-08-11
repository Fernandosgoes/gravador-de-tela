const { dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildTranscodeArgs } = require('../lib/ffmpegArgs');

// electron-builder unpacks ffmpeg-static out of app.asar (see asarUnpack in
// package.json), but ffmpeg-static's own path resolution has no asar
// awareness and still points inside app.asar, so spawn() gets a virtual path
// that doesn't exist on disk (ENOENT) unless we correct it here.
let ffmpegPath = require('ffmpeg-static');
if (ffmpegPath.includes('app.asar')) {
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}

async function transcodeToMp4(webmPath, mp4Path) {
  return new Promise((resolve, reject) => {
    const args = buildTranscodeArgs(webmPath, mp4Path);
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function saveRecording(buffer, browserWindow, format = 'mp4') {
  if (!buffer || buffer.length === 0) {
    return { success: false, error: 'Gravação vazia — nada para salvar.' };
  }

  const tempWebm = path.join(os.tmpdir(), `gravacao-${Date.now()}.webm`);
  fs.writeFileSync(tempWebm, buffer);

  const wantsWebm = format === 'webm';
  const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
    title: 'Salvar gravação',
    defaultPath: `tutorial-${Date.now()}.${wantsWebm ? 'webm' : 'mp4'}`,
    filters: wantsWebm
      ? [{ name: 'Vídeo WebM', extensions: ['webm'] }]
      : [{ name: 'Vídeo MP4', extensions: ['mp4'] }]
  });

  if (canceled || !filePath) {
    fs.unlinkSync(tempWebm);
    return { success: false };
  }

  if (wantsWebm) {
    fs.renameSync(tempWebm, filePath);
    return { success: true, path: filePath, format: 'webm' };
  }

  try {
    await transcodeToMp4(tempWebm, filePath);
    // ffmpeg can exit 0 but still leave a 0-byte/truncated file (e.g. killed
    // mid-encode) — treat that the same as a thrown error so it falls
    // through to the webm fallback instead of reporting a broken mp4 as success.
    if (fs.statSync(filePath).size === 0) {
      throw new Error('ffmpeg produziu um arquivo MP4 vazio.');
    }
    fs.unlinkSync(tempWebm);
    return { success: true, path: filePath, format: 'mp4' };
  } catch (err) {
    // Do not silently rename a broken/empty temp file and report success —
    // only fall back to the raw webm if it actually has usable content.
    const stats = fs.statSync(tempWebm);
    if (stats.size === 0) {
      fs.unlinkSync(tempWebm);
      return { success: false, error: 'A gravação capturada está vazia. Motivo: ' + err.message };
    }
    // ffmpeg may have already created/opened the target .mp4 before failing —
    // don't leave that orphaned 0-byte file sitting next to the webm fallback.
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // best-effort cleanup — a failure here shouldn't mask the fallback save
    }
    const fallbackPath = filePath.replace(/\.mp4$/, '.webm');
    fs.renameSync(tempWebm, fallbackPath);
    return { success: true, path: fallbackPath, format: 'webm', warning: err.message };
  }
}

module.exports = { saveRecording, transcodeToMp4 };
