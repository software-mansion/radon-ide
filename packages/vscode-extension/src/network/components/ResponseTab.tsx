import "./ResponseTab.css";
import IconButton from "../../webview/components/shared/IconButton";
import { NetworkLog, responseBodyInfo } from "../hooks/useNetworkTracker";
import { formatJSONBody } from "../utils/requestFormatUtils";

interface ResponseTabProps {
  networkLog: NetworkLog;
  responseBody?: responseBodyInfo;
}

const ResponseTab = ({ networkLog, responseBody }: ResponseTabProps) => {
  const { body = undefined, wasTruncated = false } = responseBody || {};
  const responseData = formatJSONBody(body);

  return (
    <>
      <div className="response-tab-button-wrapper">
        <IconButton
          className="response-tab-copy-button"
          tooltip={{ label: "Open request in new window", side: "bottom" }}
          onClick={() => console.log("placeholder")}>
          <span className="codicon codicon-chrome-restore" />
        </IconButton>
        <IconButton
          className="response-tab-copy-button"
          tooltip={{ label: "Copy to Clipboard", side: "bottom" }}
          onClick={() => navigator.clipboard.writeText(responseData)}>
          <span className="codicon codicon-copy" />
        </IconButton>
      </div>
      {wasTruncated && (
        <pre className="response-tab-truncated-warning">
          <span className="codicon codicon-warning" /> Response too large, showing truncated data.
        </pre>
      )}
      <pre className="response-tab-pre">{responseData}</pre>
    </>
  );
};

export default ResponseTab;
