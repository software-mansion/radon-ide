import { useNetwork } from "../../providers/NetworkProvider";
import { getFormattedRequestBody } from "../../utils/requestFormatters";
import IconButton from "../../../webview/components/shared/IconButton";
import TabActionButtons from "./TabActionButtons";
import { ResponseBodyData } from "../../types/network";
import { NetworkLog } from "../../types/networkLog";
import "./PayloadAndResponseTab.css";

interface ResponseTabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
}

const NO_RESPONSE_MESSAGE = "No response body";

const ResponseTab = ({ networkLog, responseBodyData }: ResponseTabProps) => {
  const { fetchAndOpenResponseInEditor } = useNetwork();
  const { body = undefined, wasTruncated = false } = responseBodyData || {};
  const responseData = getFormattedRequestBody(body);

  return (
    <>
      <TabActionButtons
        data={responseData}
        disabled={!responseData}
        additionalButtons={
          <IconButton
            className="response-tab-copy-button"
            tooltip={{ label: "Open response in editor", side: "bottom" }}
            onClick={() => {
              fetchAndOpenResponseInEditor(networkLog);
            }}
            disabled={!responseData}>
            <span className="codicon codicon-chrome-restore" />
          </IconButton>
        }
      />
      <div className="tab-padding">
        {wasTruncated && (
          <pre className="response-tab-truncated-warning">
            <span className="codicon codicon-warning" /> Response too large, showing truncated data.
          </pre>
        )}
        <pre className="response-tab-pre">{responseData ?? NO_RESPONSE_MESSAGE}</pre>
      </div>
    </>
  );
};

export default ResponseTab;
