import { useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  SortSubmenu,
  FilterItem,
  CopySubmenu,
  CopySubmenuConfig,
  SortSubmenuConfig,
  FilterItemConfig,
  CopySubmenuProps,
  SortSubmenuProps,
} from "./ContextMenuItems";
import { useNetworkFilter } from "../../providers/NetworkFilterProvider";
import "./NetworkLogContextMenu.css";

type additionalMenuItemName = "copyMenu" | "sortMenu" | "filterMenu";

interface additionalMenuItems {
  copyMenu?: CopySubmenuConfig;
  sortMenu?: SortSubmenuConfig;
  filterMenu?: FilterItemConfig;
}

interface BaseContextMenuProps {
  children: React.ReactNode;
  menuItems?: additionalMenuItems;
}

function BaseContextMenu({ children, menuItems }: BaseContextMenuProps) {
  // Filter option state handling
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

  const renderMenuItems = (): React.ReactNode => {
    const menuItemNames = Object.keys(menuItems || {}) as additionalMenuItemName[];
    if (!menuItems || menuItemNames.length === 0) {
      return null;
    }

    return menuItemNames.map((name) => {
      const { enabled, ...config } = menuItems[name]!;

      if (!enabled) {
        return null;
      }

      switch (name) {
        case "copyMenu":
          return <CopySubmenu key={name} {...(config as CopySubmenuProps)} />;
        case "sortMenu":
          return <SortSubmenu key={name} {...(config as SortSubmenuProps)} />;
        case "filterMenu":
          return <FilterItem key={name} onFocusFilter={handleFocusFilter} />;
        default:
          return null;
      }
    });
  };

  return (
    <ContextMenu.Root>
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

export default BaseContextMenu;
