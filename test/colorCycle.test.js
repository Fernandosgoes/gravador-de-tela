const { test } = require('node:test');
const assert = require('node:assert');
const { nextColor } = require('../src/lib/colorCycle');

test('cycles from off to black to blue to red to off', () => {
  assert.strictEqual(nextColor(null), '#000000');
  assert.strictEqual(nextColor('#000000'), '#0000FF');
  assert.strictEqual(nextColor('#0000FF'), '#FF0000');
  assert.strictEqual(nextColor('#FF0000'), null);
});

test('unknown current value resets to off', () => {
  assert.strictEqual(nextColor('#ABCDEF'), null);
});
