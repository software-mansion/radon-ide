export function centerCoordinates(position) {
  return {
    x: position.x - 0.5,
    y: position.y - 0.5,
    width: position.width,
    height: position.height,
  };
}

export function itIf(condition, title, fn) {
  if (condition) {
    it(title, fn);
  } else {
    it.skip(title, fn);
  }
}
