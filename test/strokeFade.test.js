const { test } = require('node:test');
const assert = require('node:assert');
const { StrokeStore } = require('../src/lib/strokeFade');

test('keeps strokes younger than 3000ms', () => {
  const store = new StrokeStore();
  store.add({ id: 'a' }, 1000);
  const remaining = store.prune(3500);
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, 'a');
});

test('removes strokes at or older than 3000ms', () => {
  const store = new StrokeStore();
  store.add({ id: 'a' }, 1000);
  const remaining = store.prune(4000);
  assert.strictEqual(remaining.length, 0);
});

test('prunes only expired strokes, keeps fresh ones', () => {
  const store = new StrokeStore();
  store.add({ id: 'old' }, 0);
  store.add({ id: 'new' }, 2000);
  const remaining = store.prune(3100);
  assert.deepStrictEqual(remaining.map(s => s.id), ['new']);
});

test('all() returns current strokes without pruning', () => {
  const store = new StrokeStore();
  store.add({ id: 'a' }, 0);
  assert.strictEqual(store.all().length, 1);
});
