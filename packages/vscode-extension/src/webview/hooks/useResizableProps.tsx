import { ResizeCallback } from "re-resizable";
import { CSSProperties, useCallback, useEffect, useState } from "react";
import { ZoomLevelType } from "../components/ZoomControls";

type UseResizableProps = {
  wrapperDivRef: React.RefObject<HTMLDivElement>;
  zoomLevel: ZoomLevelType;
  setZoomLevel: (zoomLevel: ZoomLevelType) => void;
};

const defaultResizableStyle: CSSProperties = {
  transition: "all 200ms 0ms ease-in-out",
};

type PhoneHeight = number | `${number}%`;

export function useResizableProps({ wrapperDivRef, zoomLevel, setZoomLevel }: UseResizableProps) {
  const [phoneHeight, setPhoneHeight] = useState<PhoneHeight>(0);
  const [resizableStyle, setResizableStyle] = useState<CSSProperties>(defaultResizableStyle);

  const calculateZoomLevel = useCallback(() => {
    if (phoneHeight === 0 || typeof phoneHeight === "string") {
      return;
    }

    const wrapperHeight = wrapperDivRef.current!.offsetHeight;
    setZoomLevel(Math.round((phoneHeight * 100) / wrapperHeight));
  }, [wrapperDivRef, phoneHeight, setZoomLevel]);

  const calculatePhoneHeight = useCallback(
    (delta = 0) => {
      if (zoomLevel === "Fit") {
        setPhoneHeight("100%");
        return;
      }

      const wrapperHeight = wrapperDivRef.current!.offsetHeight;
      setPhoneHeight(wrapperHeight * (zoomLevel / 100) + delta);
    },
    [wrapperDivRef, zoomLevel]
  );

  const onResizeStart = useCallback(() => setResizableStyle({}), [resizableStyle]);

  const onResizeStop: ResizeCallback = useCallback(
    (event, direction, ref, delta) => {
      calculatePhoneHeight(delta.height);
      calculateZoomLevel();
      setResizableStyle(defaultResizableStyle);
    },
    [resizableStyle]
  );

  useEffect(() => {
    const resizeObserver = new ResizeObserver(calculateZoomLevel);
    resizeObserver.observe(wrapperDivRef.current!);

    return () => resizeObserver.disconnect();
  }, [wrapperDivRef, calculateZoomLevel]);

  useEffect(calculatePhoneHeight, [zoomLevel]);

  return {
    size: { width: "auto", height: phoneHeight },
    onResizeStart,
    onResizeStop,
    lockAspectRatio: true,
    // Setting display to "none" when phoneHeight is 0 to avoid the visible size transition
    style: { ...resizableStyle, display: phoneHeight === 0 ? "none" : "initial" },
    handleStyles: {
      bottomRight: {
        right: 0,
        bottom: 0,
      },
    },
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
  };
}
