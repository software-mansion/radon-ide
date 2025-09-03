import { NetworkLogColumn, SortState } from "../types/network";
import "./NetworkLogContextMenu.css";
import BaseContextMenu from "./ContextMenu/NetworkLogContextMenu";

interface TableContextMenuProps {
  children: React.ReactNode;
  handleSort: (column: NetworkLogColumn) => void;
  sortState: SortState;
}

function TableContextMenu({ children, handleSort, sortState }: TableContextMenuProps) {
  const menuItems = {
    sortMenu: { handleSort, sortState, enabled: true },
    filterMenu: { enabled: true },
  };

  return <BaseContextMenu menuItems={menuItems}>{children}</BaseContextMenu>;
}

export default TableContextMenu;
