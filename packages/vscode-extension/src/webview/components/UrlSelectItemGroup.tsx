import React from "react";
import UrlSelectItem from "./UrlSelectItem";
import { UrlItem, UrlSelectFocusable } from "./UrlSelect";

interface UrlSelectItemGroupProps {
  items: UrlItem[];
  itemRefs: React.RefObject<HTMLDivElement>[];
  refIndexOffset?: number;
  textfieldRef: React.RefObject<HTMLInputElement>;
  width: number;
  onClose: (id: string) => void;
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
  itemRefs,
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
          item.name && (
            <UrlSelectItem
              ref={itemRefs[index + refIndexOffset]}
              item={item}
              refIndex={index + refIndexOffset}
              key={item.id}
              width={width}
              onClose={onClose}
              onNavigate={onNavigate}
              getNameFromId={getNameFromId}
              itemRefs={itemRefs}
              textfieldRef={textfieldRef}
              noHighlight={noHighlight}
            />
          )
      )}
    </>
  );
};

export default UrlSelectItemGroup;
