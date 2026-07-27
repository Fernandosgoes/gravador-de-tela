const { test } = require('node:test');
const assert = require('node:assert');
const { createToolbarState } = require('../src/lib/toolbarState');

test('starts idle and moves through full happy path', () => {
  const s = createToolbarState();
  assert.strictEqual(s.getState(), 'idle');
  s.start();
  assert.strictEqual(s.getState(), 'recording');
  s.pause();
  assert.strictEqual(s.getState(), 'paused');
  s.resume();
  assert.strictEqual(s.getState(), 'recording');
  s.stop();
  assert.strictEqual(s.getState(), 'preview');
  s.save();
  assert.strictEqual(s.getState(), 'idle');
});

test('delete from preview returns to idle', () => {
  const s = createToolbarState();
  s.start();
  s.stop();
  s.delete();
  assert.strictEqual(s.getState(), 'idle');
});

test('stop works directly from paused', () => {
  const s = createToolbarState();
  s.start();
  s.pause();
  s.stop();
  assert.strictEqual(s.getState(), 'preview');
});

test('invalid transition throws', () => {
  const s = createToolbarState();
  assert.throws(() => s.pause(), /invalid transition/);
  s.start();
  assert.throws(() => s.save(), /invalid transition/);
});

test('cancel from recording returns to idle', () => {
  const s = createToolbarState();
  s.start();
  s.cancel();
  assert.strictEqual(s.getState(), 'idle');
});

test('cancel from paused returns to idle', () => {
  const s = createToolbarState();
  s.start();
  s.pause();
  s.cancel();
  assert.strictEqual(s.getState(), 'idle');
});

test('cancel is invalid from idle and preview', () => {
  const s = createToolbarState();
  assert.throws(() => s.cancel(), /invalid transition/);
  s.start();
  s.stop();
  assert.throws(() => s.cancel(), /invalid transition/);
});
