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
  const displayDimensions = device && frame;
  let topComponentWidth, topComponentHeight;
  if (displayDimensions) {
    topComponentWidth = parseFloat((frame.width * device.screenWidth).toFixed(2));
    topComponentHeight = parseFloat((frame.height * device.screenHeight).toFixed(2));
  }

  const filteredData = inspectStack.filter((item) => !item.hide);

  return (
    <div style={{ left: inspectLocation.x, top: inspectLocation.y, position: "absolute" }}>
      <DropdownMenu.Root
        defaultOpen={true}
        open={true}
        onOpenChange={(open) => {
          if (!open) {
            onCancel();
          }
        }}>
        <DropdownMenu.Trigger />
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="context-menu-content">
            {displayDimensions && (
              <DropdownMenu.Label>
                Dimensions: {topComponentWidth} × {topComponentHeight}
              </DropdownMenu.Label>
            )}
            {filteredData.map((item, index) => {
              // extract file name from path:
              const fileName = item.source.fileName.split("/").pop();
              return (
                <DropdownMenu.Item
                  className="context-menu-item"
                  key={index}
                  onSelect={() => onSelected(item)}
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
