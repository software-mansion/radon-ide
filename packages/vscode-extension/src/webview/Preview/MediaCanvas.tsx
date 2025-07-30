import { useEffect, forwardRef, RefObject, useRef, useMemo, useCallback } from "react";
import { DeviceRotation } from "../../common/Project";
import { useStore } from "../providers/storeProvider";
import { use$ } from "@legendapp/state/react";

type MediaRef = RefObject<HTMLImageElement | null> | RefObject<HTMLVideoElement | null>;

interface MediaCanvasProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  mediaRef: MediaRef;
  src?: string;
  isAlwaysPortrait?: boolean;
}

interface TransformationConfig {
  angle: number;
  dimensionsSwapped: boolean;
  shouldDrawWithoutTransform: boolean;
}

const TRANSFORM_CONFIGS_PORTRAIT = {
  [DeviceRotation.Portrait]: {
    angle: 0,
    dimensionsSwapped: false,
    shouldDrawWithoutTransform: true
  },
  [DeviceRotation.LandscapeLeft]: {
    angle: -Math.PI / 2,
    dimensionsSwapped: true,
    shouldDrawWithoutTransform: false
  },
  [DeviceRotation.LandscapeRight]: {
    angle: Math.PI / 2,
    dimensionsSwapped: true,
    shouldDrawWithoutTransform: false
  },
  [DeviceRotation.PortraitUpsideDown]: {
    angle: Math.PI,
    dimensionsSwapped: false,
    shouldDrawWithoutTransform: false
  },
} as const;

const TRANSFORM_CONFIGS_PORTRAITUPSIDEDOWN = {
  [DeviceRotation.PortraitUpsideDown]: {
    angle: 0,
    dimensionsSwapped: false,
    shouldDrawWithoutTransform: true
  },
  [DeviceRotation.LandscapeRight]: {
    angle: -Math.PI / 2,
    dimensionsSwapped: true,
    shouldDrawWithoutTransform: false
  },
  [DeviceRotation.LandscapeLeft]: {
    angle: Math.PI / 2,
    dimensionsSwapped: true,
    shouldDrawWithoutTransform: false
  },
  [DeviceRotation.Portrait]: {
    angle: Math.PI,
    dimensionsSwapped: false,
    shouldDrawWithoutTransform: false
  },
} as const;

const TRANSFORM_CONFIGS_LANDSCAPELEFT = {
  [DeviceRotation.LandscapeLeft]: {
    angle: 0,
    dimensionsSwapped: false,
    shouldDrawWithoutTransform: true
  },
  [DeviceRotation.Portrait]: {
    angle: -Math.PI / 2,
    dimensionsSwapped: true,
    shouldDrawWithoutTransform: false
  },
  [DeviceRotation.PortraitUpsideDown]: {
    angle: Math.PI / 2,
    dimensionsSwapped: true,
    shouldDrawWithoutTransform: false
  },
  [DeviceRotation.LandscapeRight]: {
    angle: Math.PI,
    dimensionsSwapped: false,
    shouldDrawWithoutTransform: false
  },
} as const;

const TRANSFORM_CONFIGS_LANDSCAPERIGHT = {
  [DeviceRotation.LandscapeRight]: {
    angle: 0,
    dimensionsSwapped: false,
    shouldDrawWithoutTransform: true
  },
  [DeviceRotation.PortraitUpsideDown]: {
    angle: -Math.PI / 2,
    dimensionsSwapped: true,
    shouldDrawWithoutTransform: false
  },
  [DeviceRotation.Portrait]: {
    angle: Math.PI / 2,
    dimensionsSwapped: true,
    shouldDrawWithoutTransform: false
  },
  [DeviceRotation.LandscapeLeft]: {
    angle: Math.PI,
    dimensionsSwapped: false,
    shouldDrawWithoutTransform: false
  },
} as const;

const MediaCanvas = forwardRef<HTMLCanvasElement, MediaCanvasProps>(
  ({ mediaRef, src, isAlwaysPortrait, ...rest }, ref) => {
    const store$ = useStore();
    const rotation = use$(store$.workspaceConfiguration.deviceRotation);

    const isRunningRef = useRef(false);
    const canvasRef = ref as RefObject<HTMLCanvasElement>;
    const lastCanvasDimensionsRef = useRef<{ width: number; height: number } | null>(null);

    const mediaRotationOnMount = useMemo(() => {
      return rotation;
    }, [mediaRef]);

    const getTransformConfig = (): TransformationConfig => {
      if (isAlwaysPortrait) {
        return TRANSFORM_CONFIGS_PORTRAIT[rotation];
      }

      switch (mediaRotationOnMount) {
        case DeviceRotation.PortraitUpsideDown:
          return TRANSFORM_CONFIGS_PORTRAITUPSIDEDOWN[rotation];
        case DeviceRotation.LandscapeLeft:
          return TRANSFORM_CONFIGS_LANDSCAPELEFT[rotation];
        case DeviceRotation.LandscapeRight:
          return TRANSFORM_CONFIGS_LANDSCAPERIGHT[rotation];
        case DeviceRotation.Portrait:
        default:
          return TRANSFORM_CONFIGS_PORTRAIT[rotation];
      }
    };

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
        const transformConfig = getTransformConfig();
        const newWidth = transformConfig.dimensionsSwapped ? sourceHeight : sourceWidth;
        const newHeight = transformConfig.dimensionsSwapped ? sourceWidth : sourceHeight;

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

        if (transformConfig.shouldDrawWithoutTransform) {
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
      [canvasRef, rotation]
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
