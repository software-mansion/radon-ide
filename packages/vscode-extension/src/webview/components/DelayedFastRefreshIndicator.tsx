import { useState, useEffect } from "react";
import classNames from "classnames";
import "./DelayedFastRefreshIndicator.css";

export default function DelayedFastRefreshIndicator({ isRefreshing }: { isRefreshing: boolean }) {
  const [showRefreshing, setShowRefreshing] = useState(false);
  const [showRefreshed, setShowRefreshed] = useState(false);

  useEffect(() => {
    if (isRefreshing) {
      const timer = setTimeout(() => {
        setShowRefreshing(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowRefreshing(false);
      setShowRefreshed(true);
      const timer = setTimeout(() => {
        setShowRefreshed(false);
      }, 1500);
      return () => {
        clearTimeout(timer);
        setShowRefreshed(false);
      };
    }
  }, [isRefreshing]);

  const showIndicator = showRefreshing || showRefreshed;
  return (
    <div className="fast-refresh-indicator-container">
      <div className={classNames("fast-refresh-indicator", { show: showIndicator })}>
        {showRefreshing && <span className="codicon codicon-loading" />}
        {showRefreshed && <span className="codicon codicon-check" />}
        {showRefreshing && "Fast Refresh in progress..."}
        {showRefreshed && "Fast Refresh complete!"}
      </div>
    </div>
  );
}
