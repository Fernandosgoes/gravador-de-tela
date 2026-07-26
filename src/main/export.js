const { dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const { buildTranscodeArgs } = require('../lib/ffmpegArgs');

async function transcodeToMp4(webmPath, mp4Path) {
  return new Promise((resolve, reject) => {
    const args = buildTranscodeArgs(webmPath, mp4Path);
    const proc = spawn(ffmpegPath, args);
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function saveRecording(buffer, browserWindow) {
  const tempWebm = path.join(os.tmpdir(), `gravacao-${Date.now()}.webm`);
  fs.writeFileSync(tempWebm, buffer);

  const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
    title: 'Salvar gravação',
    defaultPath: `tutorial-${Date.now()}.mp4`,
    filters: [{ name: 'Vídeo MP4', extensions: ['mp4'] }]
  });

  if (canceled || !filePath) {
    fs.unlinkSync(tempWebm);
    return { success: false };
  }

  try {
    await transcodeToMp4(tempWebm, filePath);
    fs.unlinkSync(tempWebm);
    return { success: true, path: filePath, format: 'mp4' };
  } catch (err) {
    const fallbackPath = filePath.replace(/\.mp4$/, '.webm');
    fs.renameSync(tempWebm, fallbackPath);
    return { success: true, path: fallbackPath, format: 'webm', warning: err.message };
  }
}

module.exports = { saveRecording, transcodeToMp4 };
