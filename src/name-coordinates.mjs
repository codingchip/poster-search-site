/** Bounds use normalized coordinates in the original name-index canvas. */
export function getNameSourceBounds(records, mode = 'canvas') {
  if (mode === 'canvas') return { x: 0, y: 0, width: 1, height: 1 };
  if (mode !== 'content') throw new Error('nameLayerCoordinateMode 只能为 content 或 canvas');

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [, , parts] of records) {
    for (const [x, y, width, height] of parts) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + width);
      bottom = Math.max(bottom, y + height);
    }
  }
  if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
    throw new Error('姓名索引缺少有效的文字范围，无法使用 content 模式');
  }
  // Index rectangles approximate visible ink bounds; this is not pixel/OCR detection.
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function projectNamePart(part, destination, source) {
  const [x, y, width, height] = part;
  return {
    x: destination.x + (x - source.x) / source.width * destination.width,
    y: destination.y + (y - source.y) / source.height * destination.height,
    width: width / source.width * destination.width,
    height: height / source.height * destination.height,
  };
}
