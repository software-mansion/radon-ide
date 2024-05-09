import { ResizeCallback } from "re-resizable";
import { CSSProperties, useCallback, useEffect, useState } from "react";

type UseResizableProps = {
  wrapperDivRef: React.RefObject<HTMLDivElement>;
  zoomLevel: number;
  setZoomLevel: (zoomLevel: number) => void;
};

const defaultResizableStyle: CSSProperties = {
  transition: "all 200ms 0ms ease-in-out",
};

export function useResizableProps({ wrapperDivRef, zoomLevel, setZoomLevel }: UseResizableProps) {
  const [phoneHeight, setPhoneHeight] = useState(0);
  const [resizableStyle, setResizableStyle] = useState<CSSProperties>(defaultResizableStyle);

  const calculateZoomLevel = useCallback(() => {
    if (phoneHeight === 0) {
      return;
    }

    const wrapperHeight = wrapperDivRef.current!.clientHeight;
    setZoomLevel((phoneHeight * 100) / wrapperHeight);
  }, [wrapperDivRef, phoneHeight, setZoomLevel]);

  const onResizeStart = useCallback(() => setResizableStyle({}), [resizableStyle]);

  const onResizeStop: ResizeCallback = useCallback(
    (event, direction, ref, delta) => {
      setPhoneHeight(phoneHeight + delta.height);
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

  useEffect(() => {
    const wrapperHeight = wrapperDivRef.current!.clientHeight;
    setPhoneHeight(wrapperHeight * (zoomLevel / 100));
  }, [wrapperDivRef, zoomLevel]);

  return {
    size: { width: "auto", height: phoneHeight },
    onResizeStart,
    onResizeStop,
    lockAspectRatio: true,
    // Setting display to "none" when phoneHeight is 0 to avoid the visible size transition
    style: { ...resizableStyle, display: phoneHeight === 0 ? "none" : "initial" },
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
