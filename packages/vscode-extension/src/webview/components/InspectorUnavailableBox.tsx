import React, { useEffect, useState } from "react";
import "./InspectorUnavailableBox.css";

type InspectorUnavailableBoxProps = {
  clickPosition: { x: number; y: number };
  onClose: () => void;
};

function InspectorUnavailableBox({
  clickPosition,
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
      onClose();
    }, 800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, []);

  const cssPropertiesForTooltip = {
    "--top": `${clickPosition.y * 100}%`,
    "--left": `${clickPosition.x * 100}%`,
  };

  return (
    <div
      className={`dimensions-box inspector-unavailable-box ${isVisible ? "visible" : "fade-out"}`}
      style={cssPropertiesForTooltip as React.CSSProperties}>
      Inspector not available
    </div>
  );
}

export default InspectorUnavailableBox;
