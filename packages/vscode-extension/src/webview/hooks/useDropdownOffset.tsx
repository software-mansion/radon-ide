import { useState } from "react";

const SUB_CONTENT_DEFAULT_SIDE_OFFSET = -2;
const SUB_CONTENT_SMALL_WINDOW_THRESHOLD = 465;
const SUB_CONTENT_SMALL_WINDOW_SIDE_OFFSET = -200;

export const useDropdownOffset = () => {
  const [sideOffset, setSideOffset] = useState(-2);
  const [alignOffset, setAlignOffset] = useState(20);

  const calcOffset = () => {
    const width = document.body.clientWidth;
    if (width > SUB_CONTENT_SMALL_WINDOW_THRESHOLD) {
      setSideOffset(SUB_CONTENT_DEFAULT_SIDE_OFFSET);
      setAlignOffset(-5);
    } else {
      setSideOffset(SUB_CONTENT_SMALL_WINDOW_SIDE_OFFSET);
      setAlignOffset(20);
    }
  };

  return { calcOffset, sideOffset, alignOffset };
};
