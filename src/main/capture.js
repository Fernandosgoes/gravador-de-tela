const { desktopCapturer } = require('electron');

async function listSources() {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: s.thumbnail.toDataURL()
  }));
}

module.exports = { listSources };
