import { NetworkLog } from "../hooks/useNetworkTracker";
import IconButton from "../../webview/components/shared/IconButton";
import { formatJSONBody, formatGETParams } from "../utils/requestFormatUtils";

interface PayloadTabProps {
  networkLog: NetworkLog;
}

const PayloadTab = ({ networkLog }: PayloadTabProps) => {
  if (!networkLog.request) {
    return null;
  }

  const getPayloadData = () => {
    const { url, postData } = networkLog.request!;

    const urlParams = formatGETParams(url);
    const hasUrlParams = urlParams !== "{}";

    // For requests with body data, show both URL params and body
    if (postData && postData !== "") {
      const bodyData = formatJSONBody(postData);

      if (hasUrlParams) {
        return `URL Parameters:\n${urlParams}\n\nRequest Body:\n${bodyData}`;
      }
      return bodyData;
    }

    // For requests without body, show URL params if they exist
    if (hasUrlParams) {
      return urlParams;
    }

    // No URL params and no body
    return "No request body";
  };

  const payloadData = getPayloadData();

  return (
    <>
      <IconButton
        className="response-tab-copy-button"
        tooltip={{ label: "Copy to Clipboard", side: "bottom" }}
        onClick={() => navigator.clipboard.writeText(payloadData)}>
        <span className="codicon codicon-copy" />
      </IconButton>
      <pre className="response-tab-pre">{payloadData}</pre>
    </>
  );
};

export default PayloadTab;
