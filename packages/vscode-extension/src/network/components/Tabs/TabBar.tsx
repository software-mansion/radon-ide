import { useLayoutEffect, useRef } from "react";
import { useTabBar } from "../../providers/TabBarProvider";
import "./TabBar.css";

const TAB_BAR_HEIGHT = 32;

const TabBar = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { content, isVisible, setHeight } = useTabBar();

  useLayoutEffect(() => {
    if (isVisible) {
      setHeight(TAB_BAR_HEIGHT);
    } else {
      setHeight(0);
    }

    return () => setHeight(0);
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

export default TabBar;
