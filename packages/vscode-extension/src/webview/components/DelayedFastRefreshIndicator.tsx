import { useState, useEffect, useRef } from "react";
import classNames from "classnames";
import "./DelayedFastRefreshIndicator.css";
import { DeviceState } from "../../common/DeviceSession";

export default function DelayedFastRefreshIndicator({
  deviceStatus,
}: {
  deviceStatus: DeviceState["status"];
}) {
  const [showRefreshing, setShowRefreshing] = useState(false);
  const [showRefreshed, setShowRefreshed] = useState(false);
  const lastProjectStatusRef = useRef<DeviceState["status"]>(deviceStatus);

  useEffect(() => {
    const lastProjectStatus = lastProjectStatusRef.current;
    lastProjectStatusRef.current = deviceStatus;

    if (deviceStatus === "refreshing") {
      const timer = setTimeout(() => {
        setShowRefreshing(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowRefreshing(false);
    }

    if (lastProjectStatus === "refreshing" && deviceStatus === "running") {
      setShowRefreshed(true);
      const timer = setTimeout(() => {
        setShowRefreshed(false);
      }, 1500);
      return () => {
        clearTimeout(timer);
        setShowRefreshed(false);
      };
    }
  }, [deviceStatus]);

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
