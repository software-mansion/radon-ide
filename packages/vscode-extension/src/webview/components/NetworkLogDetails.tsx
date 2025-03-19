import { useEffect, useState } from "react";
import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkLogDetails.css";
import IconButton from "./shared/IconButton";
import ResizableContainer from "./shared/ResizableContainer";
import { useNetwork } from "../providers/NetworkProvider";

const TABS = ["Headers", "Payload", "Response", "Timing"];

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

const getParams = (url: string): Record<string, string> => {
  const params = url.split("?")[1];
  if (!params) {
    return {};
  }

  return params.split("&").reduce((acc: Record<string, string>, curr: string) => {
    const [key, value] = curr.split("=");
    acc[key] = value;
    return acc;
  }, {});
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
      case "Payload":
        if (!networkLog.request) {
          return null;
        }

        return networkLog.request.method === "GET" ? (
          <pre>{JSON.stringify(getParams(networkLog.request.url), null, 2)}</pre>
        ) : (
          <pre>
            {JSON.stringify(
              JSON.parse(
                typeof networkLog.request.postData === "string" ? networkLog.request.postData : "{}"
              ),
              null,
              2
            )}
          </pre>
        );
      case "Response":
        let isValidJSON = false;
        try {
          JSON.parse(typeof responseBody === "string" ? responseBody : "{}");
          isValidJSON = true;
        } catch (e) {
          isValidJSON = false;
        }
        const data =
          typeof responseBody === "string"
            ? isValidJSON
              ? JSON.stringify(
                  JSON.parse(typeof responseBody === "string" ? responseBody : "{}"),
                  null,
                  2
                )
              : responseBody
            : "No response body";
        return (
          <>
            <IconButton
              className="copy-button"
              tooltip={{ label: "Copy to Clipboard", side: "bottom" }}
              onClick={() => {
                navigator.clipboard.writeText(data);
              }}>
              <span className="codicon codicon-copy" />
            </IconButton>
            <pre>{data}</pre>
          </>
        );
      case "Timing":
        const totalTime = networkLog.timeline.durationMs || 0;
        const ttfb = networkLog.timeline.ttfb || 0;

        console.log("time:", totalTime, ttfb);

        const ttfbPercent = (ttfb / totalTime) * 100;
        const responseLoadingPercent = ((totalTime - ttfb) / totalTime) * 100;

        return (
          <div className="timing-container">
            <div className="timing-bar">
              <div className="bar request-sent-bar" style={{ width: `${ttfbPercent}%` }} />
              <div
                className="bar response-receive-bar"
                style={{ width: `${responseLoadingPercent}%` }}
              />
            </div>

            <div className="timing-section">
              <span>Waiting (TTFB): {ttfb} ms</span>
              <span>Downloading response: {totalTime - ttfb} ms</span>
              <span>Total: {totalTime} ms</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    console.log("activeTab: ", activeTab, "networkLog: ", networkLog);
    if (activeTab === "Response") {
      getResponseBody(networkLog).then((data) => {
        setResponseBody(data);
        console.log("data xyz: ", data);
      });
    }
  }, [activeTab, networkLog.requestId]);

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
