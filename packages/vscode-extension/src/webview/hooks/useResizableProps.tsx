import { ResizeCallback } from "re-resizable";
import { CSSProperties, useCallback, useEffect, useState } from "react";
import { DeviceProperties } from "../utilities/consts";
import { ZoomLevelType } from "../../common/Project";
import {
  DEVICE_DEFAULT_SCALE,
  MIN_FIT_ZOOM_LEVEL,
  FIT_MODE_WINDOW_HEIGHT_THRESHOLD,
} from "../components/ZoomControls";

type UseResizableProps = {
  wrapperDivRef: React.RefObject<HTMLDivElement>;
  zoomLevel: ZoomLevelType;
  setZoomLevel: (zoomLevel: ZoomLevelType) => void;
  device: DeviceProperties;
};

const defaultResizableStyle: CSSProperties = {
  transition: "all 200ms 0ms ease-in-out",
};

type PhoneHeight = number | `${number}%`;

export function useResizableProps({
  wrapperDivRef,
  zoomLevel,
  setZoomLevel,
  device,
}: UseResizableProps) {
  const [phoneHeight, setPhoneHeight] = useState<PhoneHeight>(0);

  const [maxWidth, setMaxWidth] = useState<"100%" | undefined>(undefined);
  const [resizableStyle, setResizableStyle] = useState<CSSProperties>(defaultResizableStyle);

  const calculatePhoneDimensions = useCallback(
    (delta = 0) => {
      if (zoomLevel === "Fit") {
        const windowHeight = document.getElementById("root")?.clientHeight ?? 0;
        if (windowHeight < FIT_MODE_WINDOW_HEIGHT_THRESHOLD) {
          setPhoneHeight(device.frameHeight * MIN_FIT_ZOOM_LEVEL * DEVICE_DEFAULT_SCALE + delta);
          setMaxWidth(undefined);
        } else {
          setPhoneHeight("100%");
          setMaxWidth("100%");
        }
        return;
      }

      setPhoneHeight(device.frameHeight * zoomLevel * DEVICE_DEFAULT_SCALE + delta);
      setMaxWidth(undefined);
    },
    [wrapperDivRef, zoomLevel]
  );

  const onResizeStart = useCallback(() => setResizableStyle({}), [resizableStyle]);

  const onResizeStop: ResizeCallback = useCallback(
    (event, direction, ref, delta) => {
      calculatePhoneDimensions(delta.height);
      setResizableStyle(defaultResizableStyle);
    },
    [resizableStyle]
  );

  useEffect(calculatePhoneDimensions, [zoomLevel]);

  useEffect(() => {
    const handleResize = () => {
      calculatePhoneDimensions();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [calculatePhoneDimensions]);

  return {
    size: { width: "auto", height: phoneHeight },
    onResizeStart,
    onResizeStop,
    lockAspectRatio: true,
    // Setting display to "none" when phoneHeight is 0 to avoid the visible size transition
    style: {
      ...resizableStyle,
      display: phoneHeight === 0 ? "none" : "flex",
      alignItems: "center",
      userSelect: "none",
    },
    handleStyles: {
      bottomRight: {
        right: 0,
        bottom: 0,
      },
    },
    maxWidth,
    enable: {
      top: false,
      right: false,
      bottom: false,
      left: false,
      topRight: false,
      bottomRight: true,
      bottomLeft: false,
      topLeft: false,
    },
  } as const;
}
