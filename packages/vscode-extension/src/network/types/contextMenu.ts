import {
  CopySubmenuConfig,
  FilterItemConfig,
  OpenInEditorItemConfig,
  SortSubmenuConfig,
} from "../components/ContextMenu/ContextMenuItems";

export enum ContextMenuItemName {
  Copy = "copy",
  Sort = "sort",
  Filter = "filter",
  OpenInEditor = "openInEditor",
}

export interface ContextMenuItems {
  [ContextMenuItemName.Copy]?: CopySubmenuConfig;
  [ContextMenuItemName.Sort]?: SortSubmenuConfig;
  [ContextMenuItemName.Filter]?: FilterItemConfig;
  [ContextMenuItemName.OpenInEditor]?: OpenInEditorItemConfig;
}
