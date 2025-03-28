import classNames from "classnames";
import { useReducer } from "react";
import { NetworkLog } from "../hooks/useNetworkTracker";

interface HeadersTabProps {
  networkLog: NetworkLog;
}

interface SectionProps {
  title: string;
  data: any;
}

const Section = ({ title, data }: SectionProps) => {
  const [isExpanded, toggleExpanded] = useReducer((s) => !s, true);

  return (
    <div className="section">
      <div className="section-header">
        <span
          className={classNames(
            "codicon",
            isExpanded ? "codicon-triangle-down" : "codicon-triangle-right",
            "gray-icon"
          )}
          onClick={toggleExpanded}
        />
        <p>{title}</p>
      </div>
      {isExpanded && (
        <div className="section-content">
          {data &&
            Object.entries(data).map(([key, value]) => (
              <div key={key} className="section-row">
                <p>{key}:</p>
                <p>{String(value)}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const HeadersTab = ({ networkLog }: HeadersTabProps) => {
  return (
    <>
      <Section title="Request Headers" data={networkLog.request?.headers} />
      <Section title="Response Headers" data={networkLog.response?.headers} />
    </>
  );
};

export default HeadersTab;
