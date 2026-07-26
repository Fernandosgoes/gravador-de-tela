const rectEl = document.getElementById('rect');
let startX = 0, startY = 0, dragging = false;

document.addEventListener('mousedown', (e) => {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  rectEl.style.display = 'block';
  rectEl.style.left = startX + 'px';
  rectEl.style.top = startY + 'px';
  rectEl.style.width = '0px';
  rectEl.style.height = '0px';
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const x = Math.min(startX, e.clientX);
  const y = Math.min(startY, e.clientY);
  const width = Math.abs(e.clientX - startX);
  const height = Math.abs(e.clientY - startY);
  rectEl.style.left = x + 'px';
  rectEl.style.top = y + 'px';
  rectEl.style.width = width + 'px';
  rectEl.style.height = height + 'px';
});

document.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  const rect = {
    x: Math.min(startX, e.clientX),
    y: Math.min(startY, e.clientY),
    width: Math.abs(e.clientX - startX),
    height: Math.abs(e.clientY - startY)
  };
  if (rect.width < 5 || rect.height < 5) return;
  window.areaSelectBridge.submit(rect);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.areaSelectBridge.submit(null);
});
