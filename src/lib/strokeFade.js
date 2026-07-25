const FADE_MS = 3000;

class StrokeStore {
  constructor() {
    this._entries = [];
  }

  add(stroke, nowMs) {
    this._entries.push({ stroke, addedAt: nowMs });
  }

  prune(nowMs) {
    this._entries = this._entries.filter(e => nowMs - e.addedAt < FADE_MS);
    return this._entries.map(e => e.stroke);
  }

  all() {
    return this._entries.map(e => e.stroke);
  }
}

module.exports = { StrokeStore, FADE_MS };
