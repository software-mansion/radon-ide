import React, { useState, useEffect, useRef, ReactNode } from "react";
import "./ResizableContainer.css";

interface ResizableContainerProps {
  containerWidth: number;
  setContainerWidth: (width: number) => void;
  children: ReactNode;
  isColumn?: boolean;
  side?: "left" | "right";
}

const ResizableContainer = ({
  containerWidth,
  setContainerWidth,
  children,
  isColumn = false,
  side = "left",
}: ResizableContainerProps) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setStartWidth(containerWidth);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !parentRef.current) {
      return;
    }
    let newWidth;
    const parentRect = parentRef.current.getBoundingClientRect();

    if (side === "left") {
      newWidth = Math.max(50, parentRect.right - e.clientX);
    } else {
      newWidth = Math.max(50, e.clientX - parentRect.left);
    }

    setContainerWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      document.body.style.userSelect = "none";
      document.body.style.cursor = isColumn ? "col-resize" : "ew-resize";
    } else {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, startX, startWidth, isColumn]);

  return (
    <div
      ref={parentRef}
      style={{
        position: "relative",
        width: `${containerWidth}px`,
        display: "flex",
        justifyContent: isColumn || side === "right" ? "flex-start" : "flex-end",
      }}>
      <div
        ref={containerRef}
        className="details"
        style={{
          transition: isDragging ? "none" : "width 0.1s ease",
        }}>
        <div
          className="draggable"
          onMouseDown={handleMouseDown}
          style={{
            right: isColumn || side === "right" ? 0 : "100%",
          }}
        />
        {isColumn && <div className="draggable-bg" />}
        <div className="content">{children}</div>
      </div>
    </div>
  );
};

export default ResizableContainer;
