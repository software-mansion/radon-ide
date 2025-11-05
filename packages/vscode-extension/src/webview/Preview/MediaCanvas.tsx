import { useEffect, forwardRef, RefObject, useRef, useMemo, useCallback } from "react";
import { use$ } from "@legendapp/state/react";
import { useStore } from "../providers/storeProvider";
import { DeviceRotation } from "../../common/State";

type MediaRef = RefObject<HTMLImageElement | null> | RefObject<HTMLVideoElement | null>;

interface MediaCanvasProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  mediaRef: MediaRef;
  src?: string;
  alwaysPortrait?: boolean;
}

interface TransformationConfig {
  angle: number;
  dimensionsSwapped: boolean;
  shouldDrawWithoutTransform: boolean;
}

/**
 * Transformation configurations for media rotation.
 *
 * These transformations are used to correctly render media (images or videos) on a canvas,
 * and are needed because of how the rotation is handled in the application. In our case,
 * we are mainly concerned with the effects this has on canvas in ReplayUI component, where
 * the video dimensions and rotation are adjusted based on the device rotation, because of
 * how video saving is handled.
 *
 * The outer key represents the original orientation of the media when it was mounted.
 * The inner key represents the current device rotation.
 *
 * - angle: Rotation angle in radians to apply to the media
 * - dimensionsSwapped: Whether width and height should be swapped for the canvas
 * - shouldDrawWithoutTransform: Whether to draw directly without applying transformation (optimization for native orientation)
 */
const TRANSFORM_CONFIGS = {
  // Media mounted in Portrait orientation
  [DeviceRotation.Portrait]: {
    // Transformations based on current device rotation
    [DeviceRotation.Portrait]: {
      angle: 0,
      dimensionsSwapped: false,
      shouldDrawWithoutTransform: true, // Native orientation
    },
    [DeviceRotation.LandscapeLeft]: {
      angle: -Math.PI / 2, // Rotate 90° counter-clockwise
      dimensionsSwapped: true,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.LandscapeRight]: {
      angle: Math.PI / 2, // Rotate 90° clockwise
      dimensionsSwapped: true,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.PortraitUpsideDown]: {
      angle: Math.PI, // Rotate 180°
      dimensionsSwapped: false,
      shouldDrawWithoutTransform: false,
    },
  },

  // Media mounted in Portrait Upside Down orientation
  [DeviceRotation.PortraitUpsideDown]: {
    // Transformations based on current device rotation
    [DeviceRotation.Portrait]: {
      angle: Math.PI, // Rotate 180°
      dimensionsSwapped: false,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.LandscapeLeft]: {
      angle: Math.PI / 2, // Rotate 90° clockwise
      dimensionsSwapped: true,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.LandscapeRight]: {
      angle: -Math.PI / 2, // Rotate 90° counter-clockwise
      dimensionsSwapped: true,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.PortraitUpsideDown]: {
      angle: 0,
      dimensionsSwapped: false,
      shouldDrawWithoutTransform: true, // Native orientation
    },
  },

  // Media mounted in Landscape Left orientation
  [DeviceRotation.LandscapeLeft]: {
    // Transformations based on current device rotation
    [DeviceRotation.Portrait]: {
      angle: Math.PI / 2, // Rotate 90° counter-clockwise
      dimensionsSwapped: true,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.LandscapeLeft]: {
      angle: 0,
      dimensionsSwapped: false,
      shouldDrawWithoutTransform: true, // Native orientation
    },
    [DeviceRotation.LandscapeRight]: {
      angle: Math.PI, // Rotate 180°
      dimensionsSwapped: false,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.PortraitUpsideDown]: {
      angle: -Math.PI / 2, // Rotate 90° clockwise
      dimensionsSwapped: true,
      shouldDrawWithoutTransform: false,
    },
  },

  // Media mounted in Landscape Right orientation
  [DeviceRotation.LandscapeRight]: {
    // Transformations based on current device rotation
    [DeviceRotation.Portrait]: {
      angle: -Math.PI / 2, // Rotate 90° clockwise
      dimensionsSwapped: true,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.LandscapeLeft]: {
      angle: Math.PI, // Rotate 180°
      dimensionsSwapped: false,
      shouldDrawWithoutTransform: false,
    },
    [DeviceRotation.LandscapeRight]: {
      angle: 0,
      dimensionsSwapped: false,
      shouldDrawWithoutTransform: true, // Native orientation
    },
    [DeviceRotation.PortraitUpsideDown]: {
      angle: Math.PI / 2, // Rotate 90° counter-clockwise
      dimensionsSwapped: true,
      shouldDrawWithoutTransform: false,
    },
  },
} as const;

const MediaCanvas = forwardRef<HTMLCanvasElement, MediaCanvasProps>(
  ({ mediaRef, src, alwaysPortrait: isAlwaysPortrait, ...rest }, ref) => {
    const store$ = useStore();
    const rotation = use$(store$.workspaceConfiguration.deviceSettings.deviceRotation);

    const isRunningRef = useRef(false);
    const canvasRef = ref as RefObject<HTMLCanvasElement>;
    const lastCanvasDimensionsRef = useRef<{ width: number; height: number } | null>(null);

    const mediaRotationOnMount = useMemo(() => {
      return rotation;
    }, [mediaRef]);

    const getTransformConfig = useCallback((): TransformationConfig => {
      // We expect the MJPEG stream to always be in Portrait orientation
      // unlike the replay video, which is dependent on the device rotation upon
      // mounting the MediaCanvas in ReplayUI.
      if (isAlwaysPortrait) {
        return TRANSFORM_CONFIGS[DeviceRotation.Portrait][rotation];
      }

      return TRANSFORM_CONFIGS[mediaRotationOnMount][rotation];
    }, [rotation, isAlwaysPortrait, mediaRotationOnMount]);

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

    // Avoid unnecessary re-renders by calling drawToCanvasRef.current
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
