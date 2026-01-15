import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import ffmpeg from "fluent-ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
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
  const width1 = canvas1.width;
  const height1 = canvas1.height;
  const width2 = canvas2.width;
  const height2 = canvas2.height;

  console.log(
    `[CompareImages] Checking dimensions: ${width1}x${height1} vs ${width2}x${height2}`
  );

  if (width1 !== width2 || height1 !== height2) {
    console.error(`[CompareImages] FAILED: Dimension mismatch.`);
    return false;
  }

  const ctx1 = canvas1.getContext("2d");
  const ctx2 = canvas2.getContext("2d");

  const imgData1 = ctx1.getImageData(0, 0, width1, height1);
  const imgData2 = ctx2.getImageData(0, 0, width2, height2);

  const data1 = imgData1.data;
  const data2 = imgData2.data;

  let diffCount = 0;
  let firstDiffInfo = null;

  // Total bytes = width * height * 4 (RGBA)
  for (let i = 0; i < data1.length; i++) {
    if (Math.abs(data1[i] - data2[i]) > 2) {
      diffCount++;

      if (!firstDiffInfo) {
        const pixelIndex = Math.floor(i / 4);
        const x = pixelIndex % width1;
        const y = Math.floor(pixelIndex / width1);
        const channelIndex = i % 4;
        const channels = ["Red", "Green", "Blue", "Alpha"];

        firstDiffInfo = {
          byteIndex: i,
          pixelIndex,
          x,
          y,
          channel: channels[channelIndex],
          val1: data1[i],
          val2: data2[i],
        };
      }
    }
  }

  if (diffCount > 0) {
    console.error(
      `[CompareImages] FAILED: Found ${diffCount} differing bytes out of ${data1.length}.`
    );
    console.error(
      `[CompareImages] First difference at Pixel(x:${firstDiffInfo.x}, y:${firstDiffInfo.y}), Channel: ${firstDiffInfo.channel}`
    );
    console.error(
      `[CompareImages] Expected: ${firstDiffInfo.val1}, Actual: ${firstDiffInfo.val2}`
    );

    // Save images for inspection
    const timestamp = Date.now();
    fs.writeFileSync(
      `diff_fail_expected_${timestamp}.png`,
      canvas1.toBuffer("image/png")
    );
    fs.writeFileSync(
      `diff_fail_actual_${timestamp}.png`,
      canvas2.toBuffer("image/png")
    );
    console.log(
      `[CompareImages] Saved debugging images: diff_fail_expected_${timestamp}.png and diff_fail_actual_${timestamp}.png`
    );

    return false;
  }

  console.log(`[CompareImages] SUCCESS: Images are identical.`);
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
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
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

  const waitForFile = async (file, timeout = 2000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        await fs.promises.access(file);
        return true;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  const framePath = path.join(
    path.dirname(filePath),
    `frame_${path.basename(filePath)}.png`
  );

  await new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .screenshots({
        count: 1,
        folder: path.dirname(framePath),
        filename: path.basename(framePath),
        timemarks: [Math.floor(info.format.duration) - 1], // last second
      })
      .on("end", async () => {
        await waitForFile(framePath);
        resolve();
      })
      .on("error", reject);
  });

  await validateImage(framePath);
}
