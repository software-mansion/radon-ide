import { useEffect, useState } from "react";
import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkLogDetails.css";
import IconButton from "./shared/IconButton";
import ResizableContainer from "./shared/ResizableContainer";
import { useNetwork } from "../providers/NetworkProvider";

const TABS = ["Headers", "Response"];

type Tab = typeof TABS[number];

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  containerWidth: number;
  handleClose: () => void;
  setContainerWidth: (width: number) => void;
}

interface TabProps {
  title: Tab;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

interface SectionProps {
  title: string;
  data: any;
}

const Tab = ({ title, activeTab, setActiveTab }: TabProps) => {
  return (
    <li onClick={() => setActiveTab(title)} className={activeTab === title ? "active" : ""}>
      <p>{title}</p>
    </li>
  );
};

const Section = ({ title, data }: SectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="section">
      <div className="section-header">
        <span
          className={`codicon ${
            isExpanded ? "codicon-triangle-down" : "codicon-triangle-right"
          } gray-icon`}
          onClick={() => setIsExpanded((prev) => !prev)}
        />
        <p>{title}</p>
      </div>
      {isExpanded && (
        <div className="section-content">
          {data &&
            Object.keys(data).map((i) => (
              <div key={i} className="section-row">
                <p>{i}:</p>
                <p>{data[i]}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const NetworkLogDetails = ({
  networkLog,
  containerWidth,
  setContainerWidth,
  handleClose,
}: NetworkLogDetailsProps) => {
  const { getResponseBody } = useNetwork();
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [responseBody, setResponseBody] = useState<unknown>();

  const renderContent = () => {
    switch (activeTab) {
      case "Headers":
        return (
          <>
            <Section title="Request Headers" data={networkLog.request?.headers} />
            <Section title="Response Headers" data={networkLog.response?.headers} />
          </>
        );
      case "Response":
        return (
          <pre>
            {JSON.stringify(
              JSON.parse(typeof responseBody === "string" ? responseBody : "{}"),
              null,
              2
            )}
          </pre>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    if (activeTab === "Response") {
      getResponseBody(networkLog).then((data) => {
        setResponseBody(data);
      });
    }
  }, [activeTab, networkLog]);

  return (
    <ResizableContainer
      containerWidth={containerWidth}
      setContainerWidth={(width) => {
        setContainerWidth(width);
      }}
      isColumn={false}
      side="left">
      <div className="details-container">
        <div className="content-header">
          <IconButton tooltip={{ label: "Close", side: "bottom" }}>
            <span className="codicon codicon-close gray-icon" onClick={handleClose} />
          </IconButton>
          <ul className="tabs">
            {TABS.map((tab) => (
              <Tab key={tab} title={tab} activeTab={activeTab} setActiveTab={setActiveTab} />
            ))}
          </ul>
        </div>
        <div className="details-content">
          <div className="invisible" />
          {renderContent()}
        </div>
      </div>
    </ResizableContainer>
  );
};

export default NetworkLogDetails;
