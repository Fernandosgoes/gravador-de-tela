const { test } = require('node:test');
const assert = require('node:assert');
const { keysToAccelerator } = require('../src/lib/shortcutRecorder');

test('builds accelerator from ctrl+shift+letter', () => {
  const result = keysToAccelerator({ ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'r' });
  assert.strictEqual(result, 'CommandOrControl+Shift+R');
});

test('returns null while only a modifier is held', () => {
  const result = keysToAccelerator({ ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, key: 'Control' });
  assert.strictEqual(result, null);
});

test('preserves special key names like function keys', () => {
  const result = keysToAccelerator({ ctrlKey: false, shiftKey: false, altKey: true, metaKey: false, key: 'F9' });
  assert.strictEqual(result, 'Alt+F9');
});

test('works with no modifiers held', () => {
  const result = keysToAccelerator({ ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, key: 'Escape' });
  assert.strictEqual(result, 'Escape');
});
