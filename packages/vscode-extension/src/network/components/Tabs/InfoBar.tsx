import { useEffect, useRef } from "react";
import { useLogDetailsBar } from "../../providers/LogDetailsBar";
import "./InfoBar.css";

const InfoBar = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { content, isVisible, setInfoBarHeight } = useLogDetailsBar();

  useEffect(() => {
    setInfoBarHeight(ref.current?.offsetHeight || 0);

    return () => setInfoBarHeight(0);
  }, []);

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
