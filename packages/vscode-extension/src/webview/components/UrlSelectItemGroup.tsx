import React from "react";
import UrlSelectItem from "./UrlSelectItem";
import { UrlSelectFocusable } from "./UrlSelect";
import { NavigationHistoryItem } from "../../common/Project";

interface UrlSelectItemGroupProps {
  items: NavigationHistoryItem[];
  itemsRef: React.RefObject<HTMLDivElement>[];
  refIndexOffset?: number;
  textfieldRef: React.RefObject<HTMLInputElement>;
  width: number;
  onClose: (item: NavigationHistoryItem) => void;
  onNavigate: (
    e: React.KeyboardEvent,
    prev?: UrlSelectFocusable,
    next?: UrlSelectFocusable
  ) => void;
  getNameFromId: (id: string) => string;
  noHighlight?: boolean;
}

const UrlSelectItemGroup: React.FC<UrlSelectItemGroupProps> = ({
  items,
  itemsRef,
  refIndexOffset = 0,
  textfieldRef,
  width,
  onClose,
  onNavigate,
  getNameFromId,
  noHighlight = false,
}) => {
  return (
    <>
      {items.map(
        (item, index) =>
          item.displayName && (
            <UrlSelectItem
              ref={itemsRef[index + refIndexOffset]}
              item={item}
              refIndex={index + refIndexOffset}
              key={item.id}
              width={width}
              onClose={onClose}
              onNavigate={onNavigate}
              getNameFromId={getNameFromId}
              itemsRef={itemsRef}
              textfieldRef={textfieldRef}
              noHighlight={noHighlight}
            />
          )
      )}
    </>
  );
};

export default UrlSelectItemGroup;
