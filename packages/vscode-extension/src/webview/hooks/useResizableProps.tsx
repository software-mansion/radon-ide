import { ResizeCallback } from "re-resizable";
import { CSSProperties, useCallback, useEffect, useState } from "react";

type UseResizableProps = {
  wrapperDivRef: React.RefObject<HTMLDivElement>;
  showDevicePreview: string | boolean | undefined;
  zoomLevel: number;
  setZoomLevel: (zoomLevel: number) => void;
};

const defaultResizableStyle: CSSProperties = {
  transition: "all 200ms 0ms ease-in-out",
};

export function useResizableProps({
  wrapperDivRef,
  showDevicePreview,
  zoomLevel,
  setZoomLevel,
}: UseResizableProps) {
  const [phoneHeight, setPhoneHeight] = useState(0);
  const [resizableStyle, setResizableStyle] = useState<CSSProperties>(defaultResizableStyle);

  // When switching between devices, state has to be reset
  useEffect(() => {
    setPhoneHeight(0);
    setZoomLevel(100);
    setResizableStyle(defaultResizableStyle);
  }, [showDevicePreview, setZoomLevel]);

  const calculateZoomLevel = useCallback(() => {
    const wrapperHeight = wrapperDivRef.current!.clientHeight;

    setZoomLevel((phoneHeight * 100) / wrapperHeight);
  }, [wrapperDivRef, phoneHeight, setZoomLevel]);

  const onResizeStart = useCallback(() => setResizableStyle({}), [resizableStyle]);

  const onResizeStop: ResizeCallback = useCallback(
    (event, direction, ref, delta) => {
      setResizableStyle(defaultResizableStyle);
      setPhoneHeight(phoneHeight + delta.height);
      calculateZoomLevel();
    },
    [resizableStyle]
  );

  useEffect(() => {
    const resizeObserver = new ResizeObserver(calculateZoomLevel);

    resizeObserver.observe(wrapperDivRef.current!);

    return () => resizeObserver.disconnect();
  }, [wrapperDivRef, calculateZoomLevel]);

  useEffect(() => {
    console.log("wrapperDivRef.current");
    const wrapperHeight = wrapperDivRef.current!.clientHeight;

    setPhoneHeight(wrapperHeight * (zoomLevel / 100));
  }, [wrapperDivRef, zoomLevel]);

  return {
    size: { width: "auto", height: phoneHeight === 0 ? "100%" : phoneHeight },
    onResizeStart,
    onResizeStop,
    lockAspectRatio: true,
    style: resizableStyle,
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
