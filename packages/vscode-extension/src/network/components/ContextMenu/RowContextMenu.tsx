import { NetworkLog } from "../../hooks/useNetworkTracker";
import { NetworkLogColumn, SortState } from "../../types/network";
import "./NetworkLogContextMenu.css";
import BaseContextMenu from "./NetworkLogContextMenu";

interface RowContextMenuProps {
  children: React.ReactNode;
  networkLog: NetworkLog | null;
  handleSort: (column: NetworkLogColumn) => void;
  sortState: SortState;
}

function RowContextMenu({ children, networkLog, handleSort, sortState }: RowContextMenuProps) {
  const menuItems = {
    copyMenu: { networkLog, enabled: true },
    sortMenu: { handleSort, sortState, enabled: true },
    filterMenu: { enabled: true },
  };

  return <BaseContextMenu menuItems={menuItems}>{children}</BaseContextMenu>;
}

export default RowContextMenu;
