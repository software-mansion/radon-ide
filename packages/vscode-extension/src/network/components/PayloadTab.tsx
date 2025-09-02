import { NetworkLog } from "../hooks/useNetworkTracker";
import IconButton from "../../webview/components/shared/IconButton";
import { getRequestPayload } from "../utils/requestFormatUtils";

interface PayloadTabProps {
  networkLog: NetworkLog;
}

const PayloadTab = ({ networkLog }: PayloadTabProps) => {
  if (!networkLog.request) {
    return null;
  }

  const payloadData = getRequestPayload(networkLog);

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
