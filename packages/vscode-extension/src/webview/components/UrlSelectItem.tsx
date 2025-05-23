import React, { PropsWithChildren } from "react";
import { UrlSelectFocusable } from "./UrlSelect";
import { NavigationHistoryItem } from "../../common/Project";

interface UrlSelectItemProps {
  item: NavigationHistoryItem;
  width: number;
  style?: React.CSSProperties;
  itemList: HTMLDivElement[];
  refIndex: number;
  textfieldRef: React.RefObject<HTMLInputElement>;
  onConfirm: (item: NavigationHistoryItem) => void;
  onArrowPress: (
    e: React.KeyboardEvent,
    prev?: UrlSelectFocusable,
    next?: UrlSelectFocusable
  ) => void;
  getNameFromId: (id: string) => string;
  noHighlight?: boolean;
}

function UrlSelectItem({
  item,
  width,
  style,
  itemList,
  refIndex,
  textfieldRef,
  onConfirm,
  onArrowPress,
  getNameFromId,
  noHighlight = false,
  ...props
}: PropsWithChildren<UrlSelectItemProps>) {
  // For readability, the substring that matches the search query is highlighted.
  // The dynamic segments from the routes are colored too, but need to be overridden
  // when the search query overlaps with them.
  // In order not to overlap HTML tags, we need to split the string into separately
  // styled segments, which can be either highlighted, colored or plain.
  const fullName = getNameFromId(item.id);
  const fullNameLower = fullName.toLowerCase();
  const searchQuery = textfieldRef.current?.value ?? "";
  const searchQueryLower = searchQuery.toLowerCase();
  const searchMatchStart =
    !noHighlight && searchQuery ? fullNameLower.indexOf(searchQueryLower) : -1;
  const searchMatchEnd = searchMatchStart !== -1 ? searchMatchStart + searchQuery.length : -1;

  const dynamicSegmentRanges = [];
  const regex = /\[[^\]]+\]/g;
  let match;
  while ((match = regex.exec(fullName)) !== null) {
    dynamicSegmentRanges.push([match.index, match.index + match[0].length]);
  }

  const segments = [];
  let i = 0;
  while (i < fullName.length) {
    // If a part of the search query, highlight and skip other steps
    if (!noHighlight && searchQuery && searchMatchStart !== -1 && i === searchMatchStart) {
      segments.push({
        text: fullName.slice(i, searchMatchEnd),
        isSearch: true,
        isDynamic: false,
      });
      i = searchMatchEnd;
      continue;
    }

    // Same for dynamic segments, but ensure they are not overlapped by search
    // Check if the current index is within a dynamic segment
    const dynamicSegment = dynamicSegmentRanges.find(([start, end]) => i >= start && i < end);
    if (dynamicSegment && (!searchQuery || i < searchMatchStart || i >= searchMatchEnd)) {
      const [_, end] = dynamicSegment;
      const segEnd =
        searchQuery && searchMatchStart !== -1 && searchMatchStart > i && searchMatchStart < end
          ? searchMatchStart
          : end;
      segments.push({
        text: fullName.slice(i, segEnd),
        isSearch: false,
        isDynamic: true,
      });
      i = segEnd;
      continue;
    }

    // Find next special substring
    let next = fullName.length;
    if (!noHighlight && searchQuery && searchMatchStart !== -1 && searchMatchStart > i) {
      next = Math.min(next, searchMatchStart);
    }
    dynamicSegmentRanges.forEach(([start, _]) => {
      if (start > i) {
        next = Math.min(next, start);
      }
    });
    segments.push({
      text: fullName.slice(i, next),
      isSearch: false,
      isDynamic: false,
    });
    i = next;
  }

  const nameWithStyles = (
    <span>
      {segments.map((segment, index) =>
        segment.isSearch ? (
          <span key={index} className="url-select-item-text-search">
            {segment.text}
          </span>
        ) : segment.isDynamic ? (
          <span key={index} className="url-select-item-text-dynamic">
            {segment.text}
          </span>
        ) : (
          <span key={index} className="url-select-item-text-plain">
            {segment.text}
          </span>
        )
      )}
    </span>
  );

  return (
    <div
      {...props}
      tabIndex={0}
      ref={(ref) => {
        if (ref === null) {
          return;
        }
        itemList[refIndex] = ref;
      }}
      className="url-select-item"
      style={style}
      onClick={() => onConfirm(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onConfirm(item);
        } else {
          onArrowPress(
            e,
            itemList[refIndex - 1] as UrlSelectFocusable,
            itemList[refIndex + 1] as UrlSelectFocusable
          );
        }
      }}>
      <div className="url-select-item-text">{nameWithStyles}</div>
    </div>
  );
}

export default UrlSelectItem;
