import { useState, useEffect, useRef } from "react";
import classNames from "classnames";
import "./DelayedFastRefreshIndicator.css";
import { ProjectState } from "../../common/Project";

export default function DelayedFastRefreshIndicator({
  projectStatus,
}: {
  projectStatus: ProjectState["status"];
}) {
  const [showRefreshing, setShowRefreshing] = useState(false);
  const [showRefreshed, setShowRefreshed] = useState(false);
  const lastProjectStatusRef = useRef<ProjectState["status"]>(projectStatus);

  useEffect(() => {
    const lastProjectStatus = lastProjectStatusRef.current;
    lastProjectStatusRef.current = projectStatus;

    if (projectStatus === "refreshing") {
      const timer = setTimeout(() => {
        setShowRefreshing(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowRefreshing(false);
    }

    if (lastProjectStatus === "refreshing" && projectStatus === "running") {
      setShowRefreshed(true);
      const timer = setTimeout(() => {
        setShowRefreshed(false);
      }, 1500);
      return () => {
        clearTimeout(timer);
        setShowRefreshed(false);
      };
    }
  }, [projectStatus]);

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
