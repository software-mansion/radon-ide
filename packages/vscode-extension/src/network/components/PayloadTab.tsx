import { NetworkLog } from "../hooks/useNetworkTracker";
import IconButton from "../../webview/components/shared/IconButton";
import { formatJSONBody, formatUrlParams } from "../utils/requestFormatUtils";

interface PayloadTabProps {
  networkLog: NetworkLog;
}

const PayloadTab = ({ networkLog }: PayloadTabProps) => {
  if (!networkLog.request) {
    return null;
  }

  const getPayloadData = () => {
    const { url, postData } = networkLog.request!;

    const urlParams = formatUrlParams(url);
    const hasUrlParams = urlParams !== "{}";

    if (postData && postData !== "") {
      const bodyData = formatJSONBody(postData);

      if (hasUrlParams) {
        return `URL Parameters:\n${urlParams}\n\nRequest Body:\n${bodyData}`;
      }
      return bodyData;
    }

    if (hasUrlParams) {
      return urlParams;
    }

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
