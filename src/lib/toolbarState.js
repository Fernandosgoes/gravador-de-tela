const TRANSITIONS = {
  idle: { start: 'recording' },
  recording: { pause: 'paused', stop: 'preview', cancel: 'idle' },
  paused: { resume: 'recording', stop: 'preview', cancel: 'idle' },
  preview: { save: 'idle', delete: 'idle' }
};

function createToolbarState() {
  let state = 'idle';

  function transition(action) {
    const next = TRANSITIONS[state] && TRANSITIONS[state][action];
    if (!next) throw new Error('invalid transition');
    state = next;
  }

  return {
    getState: () => state,
    start: () => transition('start'),
    pause: () => transition('pause'),
    resume: () => transition('resume'),
    stop: () => transition('stop'),
    cancel: () => transition('cancel'),
    save: () => transition('save'),
    delete: () => transition('delete')
  };
}

module.exports = { createToolbarState };
