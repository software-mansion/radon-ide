import { useEffect, forwardRef, RefObject } from "react";

const NO_IMAGE_DATA = "data:,";

const MjpegImg = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  (props, ref) => {
    const { src, ...rest } = props;

    // The below effect implements the main logic of this component. The primary
    // reason we can't just use img tag with src directly, is that with mjpeg streams
    // the img, after being removed from the hierarchy, will keep the connection open.
    // As a consequence, after several reloads, we will end up maintaining multiple
    // open streams which causes the UI to lag.
    // To avoid this, we manually control src attribute of the img tag and reset it
    // when the src by changing first to an empty string. We also set empty src when
    // the component is unmounted.
    useEffect(() => {
      const img = (ref as RefObject<HTMLImageElement>).current;
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
        const img = (ref as RefObject<HTMLImageElement>).current;
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

    return <img ref={ref} {...rest} />;
  }
);

export default MjpegImg;
