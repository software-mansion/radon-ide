import React from "react";
import UrlSelectItem from "./UrlSelectItem";
import { UrlSelectFocusable } from "./UrlSelect";
import { NavigationHistoryItem } from "../../common/Project";

interface UrlSelectItemGroupProps {
  items: NavigationHistoryItem[];
  itemList: HTMLDivElement[];
  refIndexOffset?: number;
  textfieldRef: React.RefObject<HTMLInputElement>;
  width: number;
  onConfirm: (item: NavigationHistoryItem) => void;
  onArrowPress: (
    e: React.KeyboardEvent,
    prev?: UrlSelectFocusable,
    next?: UrlSelectFocusable
  ) => void;
  getNameFromId: (id: string) => string;
  noHighlight?: boolean;
}

function UrlSelectItemGroup({
  items,
  itemList,
  refIndexOffset = 0,
  textfieldRef,
  width,
  onConfirm,
  onArrowPress,
  getNameFromId,
  noHighlight = false,
}: UrlSelectItemGroupProps) {
  return (
    <>
      {items.map(
        (item, index) =>
          item.displayName && (
            <UrlSelectItem
              item={item}
              refIndex={index + refIndexOffset}
              key={item.id}
              width={width}
              onConfirm={onConfirm}
              onArrowPress={onArrowPress}
              getNameFromId={getNameFromId}
              itemList={itemList}
              textfieldRef={textfieldRef}
              noHighlight={noHighlight}
            />
          )
      )}
    </>
  );
}

export default UrlSelectItemGroup;
