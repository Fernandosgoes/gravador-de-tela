// Converts a keydown event's modifier flags + key into an Electron Accelerator
// string (e.g. "CommandOrControl+Shift+R"). Returns null while only modifier
// keys are held (waits for the actual key), so the caller can keep listening.
function keysToAccelerator({ ctrlKey, metaKey, shiftKey, altKey, key }) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;
  const parts = [];
  if (ctrlKey || metaKey) parts.push('CommandOrControl');
  if (shiftKey) parts.push('Shift');
  if (altKey) parts.push('Alt');
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

module.exports = { keysToAccelerator };
