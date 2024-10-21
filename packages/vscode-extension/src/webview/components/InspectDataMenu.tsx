import * as ContextMenu from "@radix-ui/react-context-menu";
import { useEffect, useRef } from "react";
import { InspectDataStackItem } from "../../common/Project";

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

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}>
      <ContextMenu.Trigger ref={triggerRef} />
      <ContextMenu.Portal>
        <ContextMenu.Content className="context-menu-content">
          {filteredData.map((item) => {
            // extract file name from path:
            const fileName = item.source.fileName.split("/").pop();
            return (
              <ContextMenu.Item
                className="context-menu-item"
                onSelect={() => onSelected(item)}
                onMouseEnter={() => onHover(item)}>
                <code>{`<${item.componentName}>`}</code>
                <div className="right-slot">{`${fileName}:${item.source.line0Based + 1}`}</div>
              </ContextMenu.Item>
            );
          })}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
