export function centerCoordinates(position) {
  return {
    x: position.x - 0.5,
    y: position.y - 0.5,
    width: position.width,
    height: position.height,
  };
}

function describeIf(condition, title, fn) {
  if (condition) {
    describe(title, fn);
  } else {
    describe.skip(title, fn);
  }
}
