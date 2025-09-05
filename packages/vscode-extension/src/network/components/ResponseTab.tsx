import "./ResponseTab.css";
import { useEffect, useState } from "react";
import IconButton from "../../webview/components/shared/IconButton";
import { NetworkLog, responseBodyInfo } from "../hooks/useNetworkTracker";
import { useNetwork } from "../providers/NetworkProvider";
import { formatJSONBody } from "../utils/requestFormatUtils";

interface ResponseTabProps {
  networkLog: NetworkLog;
}

const ResponseTab = ({ networkLog }: ResponseTabProps) => {
  const { getResponseBody } = useNetwork();
  const [responseBody, setResponseBody] = useState<responseBodyInfo | null>(null);

  useEffect(() => {
    getResponseBody(networkLog).then((data) => {
      setResponseBody(data);
    });
  }, [networkLog.requestId]);

  const responseData = formatJSONBody(responseBody?.body);
  const wasTruncated = responseBody?.wasTruncated;

  return (
    <>
      <div>

        <IconButton
          className="response-tab-copy-button"
          tooltip={{ label: "Copy to Clipboard", side: "bottom" }}
          onClick={() => navigator.clipboard.writeText(responseData)}>
          <span className="codicon codicon-copy" />
        </IconButton>
        
        {wasTruncated && (
          <span 
            className="response-tab-warning-icon codicon codicon-warning"
            title="Data was too large and was therefore truncated"
          />
        )}
      </div>

      <pre>{responseData}</pre>
    </>
  );
};

export default ResponseTab;
