import React, { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Frame, InspectDataStackItem } from "../../common/Project";
import { DeviceProperties } from "../utilities/deviceConstants";
import "./InspectDataMenu.css";
import { commands } from "vscode";

type OnSelectedCallback = (item: InspectDataStackItem) => void;

const MAX_INSPECT_ITEMS = 5;

interface InspectItemProps {
  item: InspectDataStackItem;
  onSelected: (item: InspectDataStackItem) => void;
  onHover: (item: InspectDataStackItem) => void;
}

const InspectItem = React.forwardRef<HTMLDivElement, InspectItemProps>(
  ({ item, onSelected, onHover }, forwardedRef) => {
    const fullFileName = item.source.fileName.split("/").pop() ?? "";
    const lastDotIndex = fullFileName.lastIndexOf(".");
    const fileName = fullFileName.substring(0, lastDotIndex);
    const fileExtension = fullFileName.substring(lastDotIndex);

    return (
      <DropdownMenu.Item
        className="inspect-data-menu-item"
        data-testid={`inspect-data-menu-item-${item.componentName}-${fileName + fileExtension}-${item.source.line0Based}`}
        key={item.source.fileName + item.source.line0Based}
        onSelect={() => onSelected(item)}
        onMouseEnter={() => onHover(item)}
        ref={forwardedRef}>
        <code>{`<${item.componentName}>`}</code>
        <div className="right-slot">
          <span className="filename">{fileName}</span>
          <span>{`${fileExtension}:${item.source.line0Based + 1}`}</span>
        </div>
      </DropdownMenu.Item>
    );
  }
);

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
  const [shouldShowAll, setShouldShowAll] = useState(false);

  const displayDimensionsText = (() => {
    if (device && frame) {
      const topComponentWidth = parseFloat((frame.width * device.screenWidth).toFixed(2));
      const topComponentHeight = parseFloat((frame.height * device.screenHeight).toFixed(2));

      if (topComponentWidth && topComponentHeight) {
        return `Dimensions: ${topComponentWidth}\u00A0×\u00A0${topComponentHeight}`;
      }
    }
    return "Dimensions: -";
  })();

  const filteredData = inspectStack.filter((item) => !item.hide);
  const inspectItems =
    shouldShowAll || filteredData.length === MAX_INSPECT_ITEMS + 1
      ? filteredData
      : filteredData.slice(0, MAX_INSPECT_ITEMS);
  const inspectMenuAlign = inspectLocation.x <= window.innerWidth / 2 ? "start" : "end";
  const isOverMaxItems = filteredData.length > MAX_INSPECT_ITEMS + 1;

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
          }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="inspect-data-menu-content"
          data-testid="inspect-data-menu-content"
          sideOffset={5}
          align={inspectMenuAlign}
          collisionPadding={5}>
          <DropdownMenu.Label className="inspect-data-menu-label">
            {displayDimensionsText}
          </DropdownMenu.Label>
          <DropdownMenu.Item
            className="inspect-data-menu-item ask-ai"
            key={"ask-ai"}
            onSelect={(e) => {
              commands.executeCommand("workbench.action.chat.attachFile");
              commands.executeCommand("copilot-chat.focus");
              commands.executeCommand("workbench.panel.chat.view.copilot.toggleVisibility");
              e.preventDefault(); // prevents the dropdown from closing
            }}>
            <DropdownMenu.Label className="inspect-data-menu-label ask-ai">
              <span className="codicon codicon-lightbulb" />
              <span className="ask-ai-text">Fix with AI</span>
            </DropdownMenu.Label>
          </DropdownMenu.Item>
          {inspectItems.map((item) => (
            <InspectItem item={item} onSelected={onSelected} onHover={onHover} />
          ))}
          {isOverMaxItems && !shouldShowAll && (
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
