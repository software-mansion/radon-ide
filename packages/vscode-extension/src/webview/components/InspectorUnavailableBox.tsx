import React, { useEffect, useState } from "react";
import { DeviceProperties } from "../utilities/deviceConstants";
import "./InspectorUnavailableTooltip.css";

type InspectorUnavailableBoxProps = {
  device?: DeviceProperties;
  clickPosition: { x: number; y: number };
  wrapperDivRef: React.RefObject<HTMLDivElement | null>;
  onClose?: () => void;
};

function InspectorUnavailableBox({
  device,
  clickPosition,
  wrapperDivRef,
  onClose,
}: InspectorUnavailableBoxProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Start fade out after 0.5 seconds
    const fadeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 500);

    // Call onClose after fade animation completes (additional 0.3s)
    // as in InspectorUnavailableBox.css transition
    const closeTimer = setTimeout(() => {
      onClose?.();
    }, 800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, []);

  if (!device) {
    return null;
  }

  const previewDiv = wrapperDivRef.current?.childNodes?.[0] as unknown;

  if (
    !previewDiv ||
    typeof previewDiv !== "object" ||
    !("clientHeight" in previewDiv) ||
    typeof previewDiv.clientHeight !== "number"
  ) {
    return null;
  }

  const cssPropertiesForTooltip = {
    "--top": `${clickPosition.y * 100}%`,
    "--left": `${clickPosition.x * 100}%`,
  };

  return (
    <div
      className={`inspector-unavailable-box ${isVisible ? "visible" : "fade-out"}`}
      style={cssPropertiesForTooltip as React.CSSProperties}>
      Inspector not available
    </div>
  );
}

export default InspectorUnavailableBox;
