import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { InspectDataStackItem } from "../../common/Project";

import "./InspectDataMenu.css";

type OnSelectedCallback = (item: InspectDataStackItem) => void;

export function InspectDataMenu({
  inspectLocation,
  inspectStack,
  onSelected,
  onHover,
  onCancel,
}: {
  inspectLocation: { x: number; y: number };
  inspectStack: InspectDataStackItem[];
  onSelected: OnSelectedCallback;
  onHover: OnSelectedCallback;
  onCancel: () => void;
}) {
  const filteredData = inspectStack.filter((item) => !item.hide);

  return (
    <div style={{ right: inspectLocation.x, top: inspectLocation.y, position: "absolute" }}>
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
