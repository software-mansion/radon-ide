import "./ResponseTab.css";
import IconButton from "../../webview/components/shared/IconButton";
import { NetworkLog, responseBodyInfo } from "../hooks/useNetworkTracker";
import { formatJSONBody } from "../utils/requestFormatUtils";
import { useNetwork } from "../providers/NetworkProvider";
import TabActionButtons from "./TabActionButtons";

interface ResponseTabProps {
  networkLog: NetworkLog;
  responseBody?: responseBodyInfo;
}

const NO_RESPONSE_MESSAGE = "No response body";

const ResponseTab = ({ networkLog, responseBody }: ResponseTabProps) => {
  const { fetchAndOpenResponseInEditor } = useNetwork();
  const { body = undefined, wasTruncated = false } = responseBody || {};
  const responseData = formatJSONBody(body);

  return (
    <>
      <TabActionButtons
        data={responseData}
        disabled={!responseData}
        additionalButtons={
          <IconButton
            className="response-tab-copy-button"
            tooltip={{ label: "Open request in new window", side: "bottom" }}
            onClick={() => {
              fetchAndOpenResponseInEditor(networkLog);
            }}
            disabled={!responseData}>
            <span className="codicon codicon-chrome-restore" />
          </IconButton>
        }
      />
      {wasTruncated && (
        <pre className="response-tab-truncated-warning">
          <span className="codicon codicon-warning" /> Response too large, showing truncated data.
        </pre>
      )}
      <pre className="response-tab-pre">{responseData ?? NO_RESPONSE_MESSAGE}</pre>
    </>
  );
};

export default ResponseTab;
