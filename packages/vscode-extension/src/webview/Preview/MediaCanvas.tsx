import { useEffect, forwardRef, RefObject, useRef, useMemo, useCallback } from "react";
import { DeviceRotation } from "../../common/Project";
import { useStore } from "../providers/storeProvider";
import { use$ } from "@legendapp/state/react";

type MediaRef = RefObject<HTMLImageElement | null> | RefObject<HTMLVideoElement | null>;

interface MediaCanvasProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  mediaRef: MediaRef;
  src?: string;
}

interface TransformationConfig {
  angle: number;
  isPortrait: boolean;
  rotation: DeviceRotation;
}

const MediaCanvas = forwardRef<HTMLCanvasElement, MediaCanvasProps>(
  ({ mediaRef, src, ...rest }, ref) => {
    const store$ = useStore();
    const rotation = use$(store$.workspaceConfiguration.deviceRotation);

    const isRunningRef = useRef(false);
    const canvasRef = ref as RefObject<HTMLCanvasElement>;
    const lastCanvasDimensionsRef = useRef<{ width: number; height: number } | null>(null);

    // Memoize the transformation configuration based on rotation
    const transformConfig = useMemo<TransformationConfig>(() => {
      switch (rotation) {
        case DeviceRotation.LandscapeLeft:
          return {
            angle: -Math.PI / 2,
            isPortrait: false,
            rotation: DeviceRotation.LandscapeLeft,
          };
        case DeviceRotation.LandscapeRight:
          return {
            angle: Math.PI / 2,
            isPortrait: false,
            rotation: DeviceRotation.LandscapeRight,
          };
        case DeviceRotation.PortraitUpsideDown:
          return {
            angle: Math.PI,
            isPortrait: true,
            rotation: DeviceRotation.PortraitUpsideDown,
          };
        default:
          return {
            angle: 0,
            isPortrait: true,
            rotation: DeviceRotation.Portrait,
          };
      }
    }, [rotation]);

    const drawToCanvas = useCallback(
      (sourceImg: HTMLImageElement | HTMLVideoElement): void => {
        if (!canvasRef.current) {
          return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }

        const sourceWidth =
          sourceImg instanceof HTMLVideoElement ? sourceImg.videoWidth : sourceImg.width;
        const sourceHeight =
          sourceImg instanceof HTMLVideoElement ? sourceImg.videoHeight : sourceImg.height;

        // Early return if image dimensions are invalid
        if (sourceWidth === 0 || sourceHeight === 0) {
          return;
        }

        // Calculate actual dimensions based on rotation
        const newWidth = transformConfig.isPortrait ? sourceWidth : sourceHeight;
        const newHeight = transformConfig.isPortrait ? sourceHeight : sourceWidth;

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

        if (transformConfig.rotation === DeviceRotation.Portrait) {
          // Direct draw for portrait mode
          ctx.drawImage(sourceImg, 0, 0);
        } else {
          // Apply transformation from transformConfig
          ctx.save();
          ctx.translate(newWidth / 2, newHeight / 2);
          ctx.rotate(transformConfig.angle);
          ctx.translate(-sourceWidth / 2, -sourceHeight / 2);
          ctx.drawImage(sourceImg, 0, 0);
          ctx.restore();
        }
      },
      [canvasRef, transformConfig]
    );

    const drawToCanvasRef = useRef(drawToCanvas);

    useEffect(() => {
      drawToCanvasRef.current = drawToCanvas;
    }, [drawToCanvas]);

    // Unified canvas rendering for both image and video
    useEffect(() => {
      const mediaElement = mediaRef.current;
      const canvas = canvasRef.current;
      if (!mediaElement || !canvas) {
        return;
      }

      let animationId: number | null = null;

      const updateCanvas = () => {
        const updateFrame = () => {
          if (isRunningRef.current) {
            drawToCanvasRef.current(mediaElement);
            animationId = requestAnimationFrame(updateFrame);
          }
        };
        requestAnimationFrame(updateFrame);
      };

      const handleSourceLoad = () => {
        isRunningRef.current = true;
        updateCanvas();
      };

      const handleSourceError = () => {
        isRunningRef.current = false;
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };

      // Set up event listeners based on media type
      if (mediaElement instanceof HTMLImageElement) {
        const img = mediaElement;
        img.addEventListener("load", handleSourceLoad);
        img.addEventListener("error", handleSourceError);
      } else if (mediaElement instanceof HTMLVideoElement) {
        const video = mediaElement as HTMLVideoElement;

        // If video is already loaded and ready to play, start rendering
        if (video.readyState >= 2) {
          handleSourceLoad();
        }

        video.addEventListener("loadeddata", handleSourceLoad);
        video.addEventListener("error", handleSourceError);
      } else {
        throw new Error(
          "Unsupported media type for MediaCanvas. Only HTMLImageElement (MJPEG src) and HTMLVideoElement are supported."
        );
      }

      return () => {
        isRunningRef.current = false;
        if (animationId) {
          cancelAnimationFrame(animationId);
        }

        // removing non-existing event listener from other mediaType has no effect
        mediaElement.removeEventListener("load", handleSourceLoad);
        mediaElement.removeEventListener("loadeddata", handleSourceLoad);
        mediaElement.removeEventListener("error", handleSourceError);
      };
    }, [canvasRef, mediaRef, src]);

    return <canvas ref={canvasRef} {...rest} />;
  }
);

export default MediaCanvas;
