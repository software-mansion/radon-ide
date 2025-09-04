import "./ResponseTab.css";
import { useEffect, useState } from "react";
import IconButton from "../../webview/components/shared/IconButton";
import { NetworkLog } from "../hooks/useNetworkTracker";
import { useNetwork } from "../providers/NetworkProvider";
import { formatJSONBody } from "../utils/requestFormatUtils";
import { copyToClipboard } from "../utils/sharedUtils";

interface ResponseTabProps {
  networkLog: NetworkLog;
}

const ResponseTab = ({ networkLog }: ResponseTabProps) => {
  const { getResponseBody } = useNetwork();
  const [responseBody, setResponseBody] = useState<unknown>();

  useEffect(() => {
    getResponseBody(networkLog).then((data) => {
      setResponseBody(data);
    });
  }, [networkLog.requestId]);

  const responseData = formatJSONBody(responseBody);

  return (
    <>
      <IconButton
        className="response-tab-copy-button"
        tooltip={{ label: "Copy to Clipboard", side: "bottom" }}
        onClick={() => copyToClipboard(responseData)}>
        <span className="codicon codicon-copy" />
      </IconButton>
      <pre>{responseData}</pre>
    </>
  );
};

export default ResponseTab;
