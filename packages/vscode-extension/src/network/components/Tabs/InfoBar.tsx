import { useLayoutEffect, useRef } from "react";
import { useLogDetailsBar } from "../../providers/LogDetailsBar";
import "./InfoBar.css";

const INFO_BAR_HEIGHT = 32;

const InfoBar = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { content, isVisible, setInfoBarHeight } = useLogDetailsBar();

  useLayoutEffect(() => {
    if (isVisible) {
      setInfoBarHeight(INFO_BAR_HEIGHT);
    } else {
      setInfoBarHeight(0);
    }

    return () => setInfoBarHeight(0);
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div ref={ref} className="info-bar">
      {content}
    </div>
  );
};

export default InfoBar;
