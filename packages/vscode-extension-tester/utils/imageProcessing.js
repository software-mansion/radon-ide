import { createCanvas } from "canvas";

export function cropCanvas(canvas, position) {
  // + 0.5 to translate origin to left top corner (originally it's in the center)
  const x = Math.floor((position.x + 0.5) * canvas.width);
  const y = Math.floor((position.y + 0.5) * canvas.height);
  const width = Math.floor(position.width * canvas.width);
  const height = Math.floor(position.height * canvas.height);
  const cropped = createCanvas(width, height);
  const data = canvas.getContext("2d").getImageData(x, y, width, height);
  cropped.getContext("2d").putImageData(data, 0, 0);
  return cropped;
}

export function compareImages(canvas1, canvas2) {
  if (canvas1.width !== canvas2.width || canvas1.height !== canvas2.height)
    return false;

  const ctx1 = canvas1.getContext("2d");
  const ctx2 = canvas2.getContext("2d");
  const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data;
  const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data;

  for (let i = 0; i < data1.length; i++) {
    if (data1[i] !== data2[i]) return false;
  }
  return true;
}
