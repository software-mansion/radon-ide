import { NetworkLog } from "../../hooks/useNetworkTracker";
import {
  ContextMenuItemName,
  ContextMenuItems,
  NetworkLogColumn,
  SortState,
} from "../../types/network";
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
    [ContextMenuItemName.Copy]: { enabled: true },
    [ContextMenuItemName.Sort]: { handleSort, sortState, enabled: true },
    [ContextMenuItemName.Filter]: { enabled: true },
    [ContextMenuItemName.OpenInEditor]: { enabled: true },
  };

  return (
    <NetworkLogContextMenu networkLog={networkLog} menuItems={menuItems}>
      {children}
    </NetworkLogContextMenu>
  );
}

export default RowContextMenu;
