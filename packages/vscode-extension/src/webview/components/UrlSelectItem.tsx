import React, { PropsWithChildren } from "react";
import { UrlItem, UrlSelectFocusable } from "./UrlSelect";

interface UrlSelectItemProps {
  item: UrlItem;
  index: number;
  width: number;
  style?: React.CSSProperties;
  itemRefs: React.RefObject<HTMLDivElement>[];
  textfieldRef: React.RefObject<HTMLInputElement>;
  onClose: (id: string) => void;
  onNavigate: (
    e: React.KeyboardEvent,
    prev?: UrlSelectFocusable,
    next?: UrlSelectFocusable
  ) => void;
  getNameFromId: (id: string) => string;
}

const UrlSelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<UrlSelectItemProps>>(
  (
    {
      item,
      index,
      width,
      style,
      itemRefs,
      textfieldRef,
      onClose,
      onNavigate,
      getNameFromId,
      ...props
    },
    forwardedRef
  ) => {
    const fullName = getNameFromId(item.id);
    const searchQuery = textfieldRef.current?.value ?? "";
    const matchIndex = fullName.toLowerCase().indexOf(searchQuery.toLowerCase());

    let partBefore = fullName, partHighlighted = "", partAfter = "";
    if (searchQuery && matchIndex !== -1) {
      partBefore = fullName.slice(0, matchIndex);
      partHighlighted = fullName.slice(matchIndex, matchIndex + searchQuery.length);
      partAfter = fullName.slice(matchIndex + searchQuery.length);
    }
    const highlightedText = partHighlighted ? (
      <span className="url-select-item-text-highlighted">
        {partHighlighted}
      </span>
    ) : null;
    
    const nameWithHighlight = (
      <span>
        {partBefore}{highlightedText}{partAfter}
      </span>
    );

    return (
      <div
        {...props}
        tabIndex={0}
        ref={forwardedRef}
        className="url-select-item"
        style={{ ...style, width: width }}
        onClick={() => onClose(item.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onClose(item.id);
          } else {
            onNavigate(
              e,
              itemRefs[index - 1]?.current as UrlSelectFocusable,
              itemRefs[index + 1]?.current as UrlSelectFocusable
            );
          }
        }}>
        <div className="url-select-item-text">{nameWithHighlight}</div>
      </div>
    )
  }
);

export default UrlSelectItem;