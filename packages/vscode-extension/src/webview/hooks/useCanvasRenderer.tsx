import { RefObject, useCallback } from "react";
import { DeviceRotationType } from "../../common/Project";

function useCanvasRenderer(
  rotation: DeviceRotationType,
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const drawImageToCanvas = useCallback(
    (sourceImg: HTMLImageElement | HTMLVideoElement): void => {
      if (!canvasRef.current) {
        return;
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const imgWidth =
        sourceImg instanceof HTMLVideoElement ? sourceImg.videoWidth : sourceImg.width;
      const imgHeight =
        sourceImg instanceof HTMLVideoElement ? sourceImg.videoHeight : sourceImg.height;

      // Determine rotation angle and new dimensions
      let angle = 0;
      let newWidth = imgWidth;
      let newHeight = imgHeight;

      switch (rotation) {
        case DeviceRotationType.LandscapeLeft:
          angle = -Math.PI / 2; // -90 degrees
          newWidth = imgHeight; // swap dimensions
          newHeight = imgWidth;
          break;
        case DeviceRotationType.LandscapeRight:
          angle = Math.PI / 2; // 90 degrees
          newWidth = imgHeight; // swap dimensions
          newHeight = imgWidth;
          break;
        case DeviceRotationType.PortraitUpsideDown:
          angle = Math.PI; // 180 degrees
          break;
        default:
          // Portrait mode: no rotation
          break;
      }

      // Resize canvas to accommodate dimensions
      if(newWidth !== canvas.width || newHeight !== canvas.height) {
        canvas.width = newWidth;
        canvas.height = newHeight;
      }

      if (rotation === DeviceRotationType.Portrait) {
        // Direct draw for portrait mode
        ctx.drawImage(sourceImg, 0, 0);
      } else {
        // Apply rotation transformation
        ctx.save();
        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(angle);
        ctx.translate(-imgWidth / 2, -imgHeight / 2);
        ctx.drawImage(sourceImg, 0, 0);
        ctx.restore();
      }
    },
    [rotation, canvasRef]
  );

  return drawImageToCanvas;
}

export default useCanvasRenderer;
