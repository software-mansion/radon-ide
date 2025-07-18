import { RefObject, useCallback, useMemo, useRef } from "react";
import { DeviceRotationType } from "../../common/Project";

interface TransformationConfig {
  angle: number;
  isPortrait: boolean;
}

function useCanvasRenderer(
  rotation: DeviceRotationType,
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const lastCanvasDimensionsRef = useRef<{ width: number; height: number } | null>(null);

  // Cache the transformation configuration based on rotation
  const transformConfig = useMemo<TransformationConfig>(() => {
    switch (rotation) {
      case DeviceRotationType.LandscapeLeft:
        return {
          angle: -Math.PI / 2,
          isPortrait: false,
        };
      case DeviceRotationType.LandscapeRight:
        return {
          angle: Math.PI / 2,
          isPortrait: false,
        };
      case DeviceRotationType.PortraitUpsideDown:
        return {
          angle: Math.PI,
          isPortrait: true,
        };
      default:
        return {
          angle: 0,
          isPortrait: true,
        };
    }
  }, [rotation]);

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

      // Early return if image dimensions are invalid
      if (imgWidth === 0 || imgHeight === 0) {
        return;
      }

      // Calculate actual dimensions based on rotation
      const newWidth = transformConfig.isPortrait ? imgWidth : imgHeight;
      const newHeight = transformConfig.isPortrait ? imgHeight : imgWidth;

      const currentCanvasDims = { width: newWidth, height: newHeight };

      const canvasDimsChanged =
        !lastCanvasDimensionsRef.current ||
        lastCanvasDimensionsRef.current.width !== newWidth ||
        lastCanvasDimensionsRef.current.height !== newHeight;

      if (canvasDimsChanged) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        lastCanvasDimensionsRef.current = currentCanvasDims;
      }

      // Clear canvas
      ctx.clearRect(0, 0, newWidth, newHeight);

      if (rotation === DeviceRotationType.Portrait) {
        // Direct draw for portrait mode - fastest path
        ctx.drawImage(sourceImg, 0, 0);
      } else {
        // Apply cached transformation
        ctx.save();
        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(transformConfig.angle);
        ctx.translate(-imgWidth / 2, -imgHeight / 2);
        ctx.drawImage(sourceImg, 0, 0);
        ctx.restore();
      }
    },
    [canvasRef, transformConfig]
  );

  return drawImageToCanvas;
}

export default useCanvasRenderer;
