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
    const { method, url, postData } = networkLog.request!;

    if (method === "GET") {
      return formatGETParams(url);
    }

    // Handle other requests with no body (HEAD, OPTIONS, etc.)
    if (!postData || postData === "") {
      return "No request body";
    }

    // Handle requests with body data
    return formatJSONBody(postData);
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
