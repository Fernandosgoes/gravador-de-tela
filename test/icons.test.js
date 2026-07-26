const { test } = require('node:test');
const assert = require('node:assert');
const { ICONS } = require('../src/lib/icons');

test('exposes an SVG string for every required icon key', () => {
  const requiredKeys = [
    'monitor', 'crop', 'chevronDown', 'circle',
    'pen', 'arrowUpRight', 'folderOpen',
    'pause', 'play', 'square', 'check', 'x'
  ];
  for (const key of requiredKeys) {
    assert.ok(typeof ICONS[key] === 'string' && ICONS[key].length > 0, `missing icon: ${key}`);
    assert.ok(ICONS[key].startsWith('<svg'), `icon ${key} is not an SVG string`);
  }
});

test('stroke icons declare stroke-width 1.75', () => {
  const strokeKeys = ['monitor', 'crop', 'chevronDown', 'pen', 'arrowUpRight', 'folderOpen', 'pause', 'square', 'check', 'x'];
  for (const key of strokeKeys) {
    assert.ok(ICONS[key].includes('stroke-width="1.75"'), `icon ${key} missing stroke-width 1.75`);
  }
});
