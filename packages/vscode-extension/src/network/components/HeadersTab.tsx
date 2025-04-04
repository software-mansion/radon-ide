import { VscodeCollapsible } from "@vscode-elements/react-elements";
import { NetworkLog } from "../hooks/useNetworkTracker";

interface HeadersTabProps {
  networkLog: NetworkLog;
}

const HeadersTab = ({ networkLog }: HeadersTabProps) => {
  const requestData = networkLog.request?.headers;
  const responseData = networkLog.response?.headers;

  return (
    <>
      <VscodeCollapsible title="Request Headers">
        <div className="section-content">
          {requestData &&
            Object.entries(requestData).map(([key, value]) => (
              <div key={key} className="section-row">
                <p>{key}:</p>
                <p>{String(value)}</p>
              </div>
            ))}
        </div>
      </VscodeCollapsible>
      <VscodeCollapsible title="Response Headers" open>
        <div className="section-content">
          {responseData &&
            Object.entries(responseData).map(([key, value]) => (
              <div key={key} className="section-row">
                <p>{key}:</p>
                <p>{String(value)}</p>
              </div>
            ))}
        </div>
      </VscodeCollapsible>
    </>
  );
};

export default HeadersTab;
