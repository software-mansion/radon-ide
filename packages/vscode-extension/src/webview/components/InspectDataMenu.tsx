import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Frame, InspectDataStackItem } from "../../common/Project";
import { DeviceProperties } from "../utilities/consts";
import "./InspectDataMenu.css";

type OnSelectedCallback = (item: InspectDataStackItem) => void;

type InspectDataMenuProps = {
  inspectLocation: { x: number; y: number };
  inspectStack: InspectDataStackItem[];
  device?: DeviceProperties;
  frame: Frame | null;
  onSelected: OnSelectedCallback;
  onHover: OnSelectedCallback;
  onCancel: () => void;
};

export function InspectDataMenu({
  inspectLocation,
  inspectStack,
  device,
  frame,
  onSelected,
  onHover,
  onCancel,
}: InspectDataMenuProps) {
  const [isSelectable, setIsSelectable] = useState(false);

  const displayDimensionsText = (() => {
    if (device && frame) {
      const topComponentWidth = parseFloat((frame.width * device.screenWidth).toFixed(2));
      const topComponentHeight = parseFloat((frame.height * device.screenHeight).toFixed(2));

      if (topComponentWidth && topComponentHeight) {
        return `Dimensions: ${topComponentWidth} × ${topComponentHeight}`;
      }
    }
    return "Dimensions: -";
  })();

  const filteredData = inspectStack.filter((item) => !item.hide);

  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 2) {
        // Enables item selection only after releasing the right mouse button
        // to prevent unintended selections when opening the menu.
        setIsSelectable(true);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div style={{ left: inspectLocation.x, top: inspectLocation.y, position: "absolute" }}>
      <DropdownMenu.Root
        defaultOpen={true}
        open={true}
        onOpenChange={(open) => {
          if (isSelectable && !open) {
            onCancel();
          }
        }}>
        <DropdownMenu.Trigger />
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="inspect-data-menu-content">
            <DropdownMenu.Label className="inspect-data-menu-label">
              {displayDimensionsText}
            </DropdownMenu.Label>
            {filteredData.map((item, index) => {
              // extract file name from path:
              const fileName = item.source.fileName.split("/").pop();
              return (
                <DropdownMenu.Item
                  className="inspect-data-menu-item"
                  key={index}
                  onSelect={() => {
                    if (isSelectable) {
                      onSelected(item);
                    }
                  }}
                  onMouseEnter={() => onHover(item)}>
                  <code>{`<${item.componentName}>`}</code>
                  <div className="right-slot">{`${fileName}:${item.source.line0Based + 1}`}</div>
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
