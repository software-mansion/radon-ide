import path from "path";
import fs from "fs";

export default function startRecording(
  driver,
  directoryName = "test",
  options = {}
) {
  const screenshotsDir = path.join(process.cwd(), "videos", directoryName);
  if (fs.existsSync(screenshotsDir)) {
    fs.rmSync(screenshotsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(screenshotsDir, { recursive: true });

  let recording = true;
  const interval = options.interval || 100;

  async function recordLoop() {
    let frame = 0;
    while (recording) {
      try {
        const image = await driver.takeScreenshot();
        const filePath = path.join(
          screenshotsDir,
          `frame-${String(frame).padStart(4, "0")}.png`
        );
        fs.writeFileSync(filePath, image, "base64");
        frame++;
      } catch (error) {
        if (
          error.name === "NoSuchSessionError" ||
          error.message.includes("invalid session id")
        ) {
          console.warn(
            "Session ended during recording. Stopping screenshot capture."
          );
          break;
        }
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  recordLoop();

  return {
    stop: () => {
      recording = false;
    },
  };
}
