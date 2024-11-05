import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Frame, InspectDataStackItem } from "../../common/Project";
import { DeviceProperties } from "../utilities/consts";
import "./InspectDataMenu.css";

type OnSelectedCallback = (item: InspectDataStackItem) => void;

const MAX_INSPECT_ITEMS = 5;

type InspectDataMenuProps = {
  inspectLocation: { x: number; y: number };
  inspectScreenSide: "left" | "right";
  inspectStack: InspectDataStackItem[];
  device?: DeviceProperties;
  frame: Frame | null;
  onSelected: OnSelectedCallback;
  onHover: OnSelectedCallback;
  onCancel: () => void;
};

export function InspectDataMenu({
  inspectLocation,
  inspectScreenSide,
  inspectStack,
  device,
  frame,
  onSelected,
  onHover,
  onCancel,
}: InspectDataMenuProps) {
  const [shouldShowAll, setShouldShowAll] = useState(false);

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
  const inspectItems = shouldShowAll ? filteredData : filteredData.slice(0, MAX_INSPECT_ITEMS);

  return (
    <DropdownMenu.Root
      defaultOpen={true}
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}>
      <DropdownMenu.Trigger asChild>
        <span
          style={{
            position: "absolute",
            left: inspectLocation.x,
            top: inspectLocation.y,
            opacity: 0,
          }}></span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="inspect-data-menu-content"
          sideOffset={5}
          align={inspectScreenSide === "left" ? "start" : "end"}
          collisionPadding={5}>
          <DropdownMenu.Label className="inspect-data-menu-label">
            {displayDimensionsText}
          </DropdownMenu.Label>
          {inspectItems.map((item, index) => {
            // extract file name from path:
            const fullFileName = item.source.fileName.split("/").pop() ?? "";
            const lastDotIndex = fullFileName.lastIndexOf(".");
            const fileName = fullFileName.substring(0, lastDotIndex);
            const fileExtension = fullFileName.substring(lastDotIndex);
            return (
              <DropdownMenu.Item
                className="inspect-data-menu-item"
                key={index}
                onSelect={() => onSelected(item)}
                onMouseEnter={() => onHover(item)}>
                <code>{`<${item.componentName}>`}</code>
                <div className="right-slot">
                  <span className="filename">{fileName}</span>
                  <span>{`${fileExtension}:${item.source.line0Based + 1}`}</span>
                </div>
              </DropdownMenu.Item>
            );
          })}
          {filteredData.length > MAX_INSPECT_ITEMS && !shouldShowAll && (
            <DropdownMenu.Item
              className="inspect-data-menu-item show-all"
              key={"show-all"}
              onSelect={(e) => {
                setShouldShowAll(true);
                e.preventDefault(); // prevents the dropdown from closing
              }}>
              <DropdownMenu.Label className="inspect-data-menu-label">Show all</DropdownMenu.Label>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
