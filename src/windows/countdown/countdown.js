const numEl = document.getElementById('num');
let count = 3;

function tick() {
  numEl.textContent = String(count);
  // restart the CSS animation on each tick
  numEl.style.animation = 'none';
  // eslint-disable-next-line no-unused-expressions
  numEl.offsetHeight;
  numEl.style.animation = '';

  count -= 1;
  if (count < 0) {
    window.countdownBridge.done();
    return;
  }
  setTimeout(tick, 1000);
}

tick();
