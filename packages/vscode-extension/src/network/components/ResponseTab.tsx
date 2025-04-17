import "./ResponseTab.css";
import { useEffect, useState } from "react";
import IconButton from "../../webview/components/shared/IconButton";
import { NetworkLog } from "../hooks/useNetworkTracker";
import { useNetwork } from "../providers/NetworkProvider";

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

  const formatResponseBody = (body: unknown): string => {
    if (typeof body !== "string") {
      return "No response body";
    }
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  };

  const responseData = formatResponseBody(responseBody);

  return (
    <>
      <IconButton
        className="response-tab-copy-button"
        tooltip={{ label: "Copy to Clipboard", side: "bottom" }}
        onClick={() => navigator.clipboard.writeText(responseData)}>
        <span className="codicon codicon-copy" />
      </IconButton>
      <pre>{responseData}</pre>
    </>
  );
};

export default ResponseTab;
