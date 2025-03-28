import { useState } from "react";
import "./NetworkLogDetails.css";
import IconButton from "../../webview/components/shared/IconButton";
import ResizableContainer from "../../webview/components/shared/ResizableContainer";
import HeadersTab from "./HeadersTab";
import PayloadTab from "./PayloadTab";
import ResponseTab from "./ResponseTab";
import TimingTab from "./TimingTab";
import { NetworkLog } from "../hooks/useNetworkTracker";

enum Tab {
  Headers = "Headers",
  Payload = "Payload",
  Response = "Response",
  Timing = "Timing",
}
const TABS = Object.values(Tab);

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  containerWidth: number;
  handleClose: () => void;
  setContainerWidth: (width: number) => void;
}

const NetworkLogDetails = ({
  networkLog,
  containerWidth,
  setContainerWidth,
  handleClose,
}: NetworkLogDetailsProps) => {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.Headers:
        return <HeadersTab networkLog={networkLog} />;
      case Tab.Payload:
        return <PayloadTab networkLog={networkLog} />;
      case Tab.Response:
        return <ResponseTab networkLog={networkLog} />;
      case Tab.Timing:
        return <TimingTab networkLog={networkLog} />;
      default:
        return null;
    }
  };

  return (
    <ResizableContainer
      showDragable={false}
      containerSize={containerWidth}
      setContainerWidth={setContainerWidth}
      isColumn={false}
      side="left">
      <div className="details-container">
        <div className="content-header">
          <IconButton tooltip={{ label: "Close", side: "bottom" }}>
            <span className="codicon codicon-close gray-icon" onClick={handleClose} />
          </IconButton>
          <ul className="tabs">
            {TABS.map((tab) => (
              <li
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? "active" : ""}>
                <p>{tab}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="details-content">
          <div className="invisible" />
          <div className="selected-tab-content">{renderContent()}</div>
        </div>
      </div>
    </ResizableContainer>
  );
};

export default NetworkLogDetails;
