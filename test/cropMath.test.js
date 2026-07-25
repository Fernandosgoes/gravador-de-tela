const { test } = require('node:test');
const assert = require('node:assert');
const { toCropParams } = require('../src/lib/cropMath');

test('normalizes a forward drag rect', () => {
  const result = toCropParams({ x: 10, y: 20, width: 300, height: 200 }, { width: 1920, height: 1080 });
  assert.deepStrictEqual(result, { x: 10, y: 20, width: 300, height: 200 });
});

test('normalizes a reverse drag (negative width/height)', () => {
  const result = toCropParams({ x: 500, y: 400, width: -300, height: -200 }, { width: 1920, height: 1080 });
  assert.deepStrictEqual(result, { x: 200, y: 200, width: 300, height: 200 });
});

test('clamps rect to source bounds', () => {
  const result = toCropParams({ x: -50, y: -30, width: 200, height: 100 }, { width: 1920, height: 1080 });
  assert.deepStrictEqual(result, { x: 0, y: 0, width: 150, height: 70 });
});

test('clamps rect exceeding right/bottom edge', () => {
  const result = toCropParams({ x: 1800, y: 1000, width: 300, height: 200 }, { width: 1920, height: 1080 });
  assert.deepStrictEqual(result, { x: 1800, y: 1000, width: 120, height: 80 });
});
