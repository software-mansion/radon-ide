import { useEffect, forwardRef, RefObject, useRef, useCallback } from "react";
import { DeviceRotationType } from "../../common/Project";
import { useProject } from "../providers/ProjectProvider";

const NO_IMAGE_DATA = "data:,";

function useCanvasRenderer(
  rotation: DeviceRotationType,
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const drawImageToCanvas = useCallback(
    (sourceImg: HTMLImageElement): void => {
      if (!canvasRef.current) {
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const { width: imgWidth, height: imgHeight } = sourceImg;

      // Determine rotation angle and new dimensions
      let angle = 0;
      let newWidth = imgWidth;
      let newHeight = imgHeight;

      switch (rotation) {
        case DeviceRotationType.LandscapeLeft:
          angle = -Math.PI / 2; // -90 degrees
          newWidth = imgHeight;
          newHeight = imgWidth;
          break;
        case DeviceRotationType.LandscapeRight:
          angle = Math.PI / 2; // 90 degrees
          newWidth = imgHeight;
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
      canvas.width = newWidth;
      canvas.height = newHeight;

      // Clear and draw
      ctx.clearRect(0, 0, newWidth, newHeight);

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

const MjpegImg = forwardRef<
  HTMLCanvasElement,
  React.CanvasHTMLAttributes<HTMLCanvasElement> & { src?: string }
>((props, ref) => {
  const { src, ...rest } = props;
  const { projectState } = useProject();
  const rotation = projectState.rotation;

  const canvasRef = ref as RefObject<HTMLCanvasElement>;
  const sourceImgRef = useRef<HTMLImageElement>(null);

  const drawToCanvas = useCanvasRenderer(rotation, canvasRef);

  // The below effect implements the main logic of this component. The primary
  // reason we can't just use img tag with src directly, is that with mjpeg streams
  // the img, after being removed from the hierarchy, will keep the connection open.
  // As a consequence, after several reloads, we will end up maintaining multiple
  // open streams which causes the UI to lag.
  // To avoid this, we manually control src attribute of the img tag and reset it
  // when the src by changing first to an empty string. We also set empty src when
  // the component is unmounted.
  useEffect(() => {
    const img = sourceImgRef.current;
    if (!img) {
      return;
    }
    img.src = NO_IMAGE_DATA;
    img.src = src || NO_IMAGE_DATA;
    return () => {
      img.src = NO_IMAGE_DATA;
    };
  }, [ref, src]);

  // The sole purpose of the below effect is to periodically call `decode` on the image
  // in order to detect when the stream connection is dropped. There seem to be no better
  // way to handle it apart from this. When `decode` fails, we reset the image source to
  // trigger a new connection.
  useEffect(() => {
    let timer: NodeJS.Timeout;

    let cancelled = false;
    async function checkIfImageLoaded() {
      const img = sourceImgRef.current;
      if (img?.src) {
        try {
          // waits until image is ready to be displayed
          await img.decode();
        } catch {
          // Stream connection was dropped
          if (!cancelled) {
            const srcCopy = img.src;
            img.src = NO_IMAGE_DATA;
            img.src = srcCopy;
          }
        }
      }
      if (!cancelled) {
        timer = setTimeout(checkIfImageLoaded, 2_000);
      }
    }
    checkIfImageLoaded();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ref]);

  // useEffect for drawing onto the canvas
  useEffect(() => {
    const sourceImg = sourceImgRef.current;
    const canvas = canvasRef.current;
    if (!sourceImg || !canvas) {
      return;
    }

    let intervalId: NodeJS.Timeout;

    const updateCanvas = () => {
      drawToCanvas(sourceImg);
    };

    const handleSourceLoad = () => {
      updateCanvas();
      // continuously update the canvas
      intervalId = setInterval(updateCanvas, 17); // ~60 FPS
    };

    const handleSourceError = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      clearInterval(intervalId);
    };

    sourceImg.addEventListener("load", handleSourceLoad);
    sourceImg.addEventListener("error", handleSourceError);

    // Reset and set source
    sourceImg.src = NO_IMAGE_DATA;
    sourceImg.src = src || NO_IMAGE_DATA;

    return () => {
      clearInterval(intervalId);
      sourceImg.removeEventListener("load", handleSourceLoad);
      sourceImg.removeEventListener("error", handleSourceError);
      sourceImg.src = NO_IMAGE_DATA;
    };
  }, [canvasRef, src, rotation, drawToCanvas]);

  return (
    <>
      <img ref={sourceImgRef} style={{ display: "none" }} crossOrigin="anonymous" />

      <canvas ref={canvasRef} {...rest} />
    </>
  );
});

export default MjpegImg;
