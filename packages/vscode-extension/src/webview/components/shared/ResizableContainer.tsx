import React, { useState, useEffect, useRef, ReactNode } from "react";
import "./ResizableContainer.css";

interface ResizableContainerProps {
  containerWidth: number;
  setContainerWidth: (width: number) => void;
  children: ReactNode;
  isColumn?: boolean;
  side?: "left" | "right" | "bottom";
  showDragable?: boolean;
}

const MIN_WIDTH = 50;

const ResizableContainer = ({
  containerWidth,
  setContainerWidth,
  children,
  isColumn = false,
  side = "left",
  showDragable = true,
}: ResizableContainerProps) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
    setStartWidth(containerWidth);
    setStartHeight(containerWidth);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !parentRef.current) {
      return;
    }
    let newSize;
    const parentRect = parentRef.current.getBoundingClientRect();

    if (side === "left") {
      newSize = Math.max(MIN_WIDTH, parentRect.right - e.clientX);
    } else if (side === "right") {
      newSize = Math.max(MIN_WIDTH, e.clientX - parentRect.left);
    } else if (side === "bottom") {
      newSize = Math.max(MIN_WIDTH, e.clientY - parentRect.top);
    }

    setContainerWidth(newSize || MIN_WIDTH);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      document.body.style.userSelect = "none";
      document.body.style.cursor =
        side === "bottom" ? "row-resize" : isColumn ? "col-resize" : "ew-resize";
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
  }, [isDragging, startX, startY, startWidth, startHeight, isColumn, side]);

  return (
    <div
      ref={parentRef}
      style={{
        position: "relative",
        width: side === "bottom" ? "100%" : `${containerWidth}px`,
        height: side === "bottom" ? `${containerWidth}px` : "auto",
        display: "flex",
        flexDirection: side === "bottom" ? "column" : "row",
        justifyContent:
          side === "right" || isColumn ? "flex-start" : side === "bottom" ? "flex-end" : "flex-end",
      }}>
      <div
        ref={containerRef}
        className="details"
        style={{
          transition: isDragging ? "none" : "width 0.1s ease, height 0.1s ease",
        }}>
        <div
          className="draggable"
          onMouseDown={handleMouseDown}
          style={{
            cursor: side === "bottom" ? "row-resize" : "col-resize",
            right: side === "right" || side === "bottom" || isColumn ? 0 : "100%",
            top: side === "bottom" ? "100%" : "auto",
            opacity: showDragable ? 1 : 0,
            width: side === "bottom" ? "100%" : !showDragable ? 10 : 1,
            height: side === "bottom" ? 5 : "100%",
          }}
        />
        {isColumn && <div className="draggable-bg" />}
        <div className="content">{children}</div>
      </div>
    </div>
  );
};

export default ResizableContainer;
