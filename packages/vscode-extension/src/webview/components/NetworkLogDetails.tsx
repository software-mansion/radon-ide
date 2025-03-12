import { RefObject, useState } from "react";
import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkLogDetails.css";
import IconButton from "./shared/IconButton";
import ResizableContainer from "./shared/ResizableContainer";

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  parentRef: RefObject<HTMLDivElement>;
  handleClose: () => void;
  handleContainerSize: (width: number) => void;
}

const NetworkLogDetails = ({
  networkLog,
  parentRef,
  handleClose,
  handleContainerSize,
}: NetworkLogDetailsProps) => {
  const [containerWidth, setContainerWidth] = useState(500);

  return (
    <ResizableContainer
      containerWidth={containerWidth}
      setContainerWidth={(width) => {
        setContainerWidth(width);
        handleContainerSize(width);
      }}
      isColumn={false}
      side="left">
      <>
        <div className="content-header">
          <IconButton tooltip={{ label: "Close", side: "bottom" }}>
            <span className="codicon codicon-close gray-icon" onClick={handleClose} />
          </IconButton>
        </div>
        <div style={{ padding: "8px" }}>
          {networkLog ? JSON.stringify(networkLog) : "Select a network log to view details"}
        </div>
      </>
    </ResizableContainer>
  );
};

export default NetworkLogDetails;
