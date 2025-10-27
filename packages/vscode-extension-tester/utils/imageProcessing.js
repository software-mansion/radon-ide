import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import ffmpeg from "fluent-ffmpeg";
import ffprobeStatic from "ffprobe-static";
import { assert } from "chai";

export function cropCanvas(canvas, position) {
  const x = Math.floor(position.x * canvas.width);
  const y = Math.floor(position.y * canvas.height);
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

// Instead of comparing with a reference image (screenshots can vary by device, OS etc.),
// I validate the screenshot by checking its dimensions and ensuring it contains multiple colors.
export async function validateImage(filePath) {
  const img = await loadImage(filePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;

  assert.ok(img.width > 1 && img.height > 1, "Invalid dimensions");

  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const mean = sum / (img.width * img.height);
  const uniqueColors = new Set();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    uniqueColors.add(`${r},${g},${b}`);
  }

  assert.isAbove(mean, 5, "Screenshot seems empty or nearly black");
  assert.isAbove(
    uniqueColors.size,
    10,
    "Screenshot has too few unique colors; it may be invalid"
  );
}

export async function validateVideo(filePath, expectedDuration = null) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);

  async function getVideoInfo(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }

  assert.ok(fs.existsSync(filePath), "Video file does not exist");

  const info = await getVideoInfo(filePath);
  const videoStream = info.streams.find((s) => s.codec_type === "video");

  assert.ok(videoStream, "No video stream found");
  assert.ok(
    videoStream.width > 0 && videoStream.height > 0,
    "Invalid resolution"
  );

  if (expectedDuration)
    assert.approximately(
      info.format.duration,
      expectedDuration,
      0.5,
      "Video duration is not as expected"
    );

  const framePath = path.join(path.dirname(filePath), "tmp_video_frame.png");

  // if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
  console.log("Duration:", info.format.duration);

  await new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .screenshots({
        count: 1,
        folder: path.dirname(framePath),
        filename: path.basename(framePath),
        timemarks: [Math.ceil(info.format.duration - 1)], // frame at last second
      })
      .on("end", resolve)
      .on("error", reject);
  });

  await new Promise((res) => setTimeout(res, 3000));

  console.log(fs.existsSync(framePath));

  await validateImage(framePath);
}
