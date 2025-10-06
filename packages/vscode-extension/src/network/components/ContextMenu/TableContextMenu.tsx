import "./NetworkLogContextMenu.css";
import NetworkLogContextMenu from "./NetworkLogContextMenu";
import { ContextMenuItems, ContextMenuItemName } from "../../types/contextMenu";
import { SortState } from "../../types/networkFilter";
import { NetworkLogColumn } from "../../types/networkLog";

interface TableContextMenuProps {
  children: React.ReactNode;
  handleSort: (column: NetworkLogColumn) => void;
  sortState: SortState;
}

function TableContextMenu({ children, handleSort, sortState }: TableContextMenuProps) {
  const menuItems: ContextMenuItems = {
    [ContextMenuItemName.Sort]: { handleSort, sortState, enabled: true },
    [ContextMenuItemName.Filter]: { enabled: true },
  };

  return <NetworkLogContextMenu menuItems={menuItems}>{children}</NetworkLogContextMenu>;
}

export default TableContextMenu;
