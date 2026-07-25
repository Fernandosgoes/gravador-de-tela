const CYCLE = [null, '#000000', '#0000FF', '#FF0000'];

function nextColor(current) {
  const idx = CYCLE.indexOf(current);
  if (idx === -1) return null;
  return CYCLE[(idx + 1) % CYCLE.length];
}

module.exports = { nextColor };
