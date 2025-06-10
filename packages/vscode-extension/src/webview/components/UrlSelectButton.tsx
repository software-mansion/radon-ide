import React, { PropsWithChildren } from "react";
import { UrlSelectFocusable } from "./UrlSelect";

interface UrlSelectButtonProps {
  style?: React.CSSProperties;
  itemList: HTMLDivElement[];
  refIndex: number;
  onConfirm: () => void;
  onArrowPress: (
    e: React.KeyboardEvent,
    prev?: UrlSelectFocusable,
    next?: UrlSelectFocusable
  ) => void;
}

function UrlSelectButton({
  children,
  style,
  itemList,
  refIndex,
  onConfirm,
  onArrowPress,
  ...props
}: PropsWithChildren<UrlSelectButtonProps>) {
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
      className="url-select-item url-select-button"
      style={style}
      onClick={() => onConfirm()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onConfirm();
        } else {
          onArrowPress(
            e,
            itemList[refIndex - 1] as UrlSelectFocusable,
            itemList[refIndex + 1] as UrlSelectFocusable
          );
        }
      }}>
      <div className="url-select-button-text">{children}</div>
    </div>
  );
}

export default UrlSelectButton;
