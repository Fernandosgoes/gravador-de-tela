function toCropParams(rect, sourceSize) {
  let x = rect.width < 0 ? rect.x + rect.width : rect.x;
  let y = rect.height < 0 ? rect.y + rect.height : rect.y;
  let width = Math.abs(rect.width);
  let height = Math.abs(rect.height);

  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > sourceSize.width) {
    width = sourceSize.width - x;
  }
  if (y + height > sourceSize.height) {
    height = sourceSize.height - y;
  }

  return { x, y, width, height };
}

module.exports = { toCropParams };
