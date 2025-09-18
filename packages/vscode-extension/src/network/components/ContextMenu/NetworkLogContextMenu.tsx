import { useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  SortSubmenu,
  FilterItem,
  CopySubmenu,
  SortSubmenuProps,
  OpenInEditorItem,
} from "./ContextMenuItems";
import { useNetworkFilter } from "../../providers/NetworkFilterProvider";
import { ResponseBodyData } from "../../types/network";
import { NetworkLog } from "../../types/networkLog";
import { useNetwork } from "../../providers/NetworkProvider";
import { ContextMenuItemName, ContextMenuItems } from "../../types/contextMenu";
import "./NetworkLogContextMenu.css";

interface NetworkLogContextMenuProps {
  children: React.ReactNode;
  menuItems?: ContextMenuItems;
  networkLog?: NetworkLog | null;
}

function NetworkLogContextMenu({ children, menuItems, networkLog }: NetworkLogContextMenuProps) {
  // Filter-item state handling
  // Below is needed, because RadixUI modifies focus upon context menu closing.
  // If we wish to direct the focus to the input field when clicking a button, we have to
  // first wait for the closeAutoFocus event and only then direct the focus to the right component
  const [shouldFocusInput, setShouldFocusInput] = useState(false);
  const { focusFilterInput } = useNetworkFilter();

  const handleFocusLose = () => {
    if (shouldFocusInput) {
      focusFilterInput();
      setShouldFocusInput(false);
    }
  };

  const handleFocusFilter = () => {
    setShouldFocusInput(true);
  };

  // Response body state handling
  const [responseBodyData, setResponseBodyData] = useState<ResponseBodyData | undefined>(undefined);
  const { getResponseBody } = useNetwork();

  const handleOpenChange = async (open: boolean) => {
    // In order to prevent fetching responseBody as soon as the request log is rendered
    // (which has memory implications on the backend), we wait until the user
    // opens the menu for the first time
    if (!open || !networkLog) {
      return;
    }
    // Prefetch response body for copy menu when context menu opens
    const bodyData = await getResponseBody(networkLog);
    setResponseBodyData(bodyData);
  };

  const renderMenuItems = (): React.ReactNode => {
    const menuItemNames = Object.keys(menuItems || {}) as ContextMenuItemName[];
    if (!menuItems || menuItemNames.length === 0) {
      return null;
    }

    return menuItemNames.map((name) => {
      const { enabled, ...config } = menuItems[name]!;

      if (!enabled) {
        return null;
      }

      switch (name) {
        case ContextMenuItemName.Copy:
          return (
            <CopySubmenu
              key={name}
              networkLog={networkLog ?? null}
              responseBodyData={responseBodyData}
            />
          );
        case ContextMenuItemName.OpenInEditor:
          return (
            <OpenInEditorItem
              key={name}
              networkLog={networkLog ?? null}
              responseBodyData={responseBodyData}
            />
          );
        case ContextMenuItemName.Sort:
          return <SortSubmenu key={name} {...(config as SortSubmenuProps)} />;
        case ContextMenuItemName.Filter:
          return <FilterItem key={name} onFocusFilter={handleFocusFilter} />;
        default:
          return null;
      }
    });
  };

  return (
    <ContextMenu.Root onOpenChange={handleOpenChange}>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="radix-context-menu-content"
          onContextMenu={(e) => e.preventDefault()}
          onCloseAutoFocus={handleFocusLose}>
          {renderMenuItems()}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export default NetworkLogContextMenu;
