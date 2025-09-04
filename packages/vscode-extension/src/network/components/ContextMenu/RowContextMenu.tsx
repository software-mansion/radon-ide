import { NetworkLog } from "../../hooks/useNetworkTracker";
import { ContextMenuItems, NetworkLogColumn, SortState } from "../../types/network";
import "./NetworkLogContextMenu.css";
import NetworkLogContextMenu from "./NetworkLogContextMenu";

interface RowContextMenuProps {
  children: React.ReactNode;
  networkLog: NetworkLog | null;
  handleSort: (column: NetworkLogColumn) => void;
  sortState: SortState;
}

function RowContextMenu({ children, networkLog, handleSort, sortState }: RowContextMenuProps) {
  const menuItems: ContextMenuItems = {
    copy: { networkLog, enabled: true },
    sort: { handleSort, sortState, enabled: true },
    filter: { enabled: true },
  };

  return <NetworkLogContextMenu menuItems={menuItems}>{children}</NetworkLogContextMenu>;
}

export default RowContextMenu;
