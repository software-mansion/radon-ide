import { useEffect, forwardRef, RefObject, useRef } from "react";
import { useProject } from "../providers/ProjectProvider";
import useCanvasRenderer from "../hooks/useCanvasRenderer";

type MediaRef = RefObject<HTMLImageElement | null> | RefObject<HTMLVideoElement | null>;

interface MediaCanvasProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  mediaRef: MediaRef;
  src?: string;
}

const MediaCanvas = forwardRef<HTMLCanvasElement, MediaCanvasProps>(
  ({ mediaRef, src, ...rest }, ref) => {
    const { projectState } = useProject();
    const rotation = projectState.rotation;

    const isRunningRef = useRef(false);
    const canvasRef = ref as RefObject<HTMLCanvasElement>;
    const drawToCanvas = useCanvasRenderer(rotation, canvasRef);
    const drawToCanvasRef = useRef(drawToCanvas);

    useEffect(() => {
      drawToCanvasRef.current = drawToCanvas;
    }, [drawToCanvas]);

    // Unified canvas rendering effect for both image and video
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
          "Unsupported media type for MediaCanvas. Only HTMLImageElement (MJPEG) and HTMLVideoElement are supported."
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
