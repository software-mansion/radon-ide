import { useNetwork } from "../../providers/NetworkProvider";
import { determineLanguage, getFormattedRequestBody } from "../../utils/requestFormatters";
import IconButton from "../../../webview/components/shared/IconButton";
import TabActionButtons from "./TabActionButtons";
import HighlightedCodeBlock from "./HighlightedCodeBlock";
import { ResponseBodyData } from "../../types/network";
import { NetworkLog } from "../../types/networkLog";
import "./PayloadAndResponseTab.css";
import { ThemeData } from "../../../common/theme";
import { NetworkEvent } from "../../types/panelMessageProtocol";

interface ResponseTabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
  editorThemeData?: ThemeData;
}

const ResponseTab = ({ networkLog, responseBodyData, editorThemeData }: ResponseTabProps) => {
  const { fetchAndOpenResponseInEditor } = useNetwork();
  const { body = undefined, wasTruncated = false } = responseBodyData || {};
  const responseData = getFormattedRequestBody(body);
  const contentType = networkLog.response?.headers?.["Content-Type"] || "";
  const language = responseData ? determineLanguage(contentType, responseData) : "plaintext";

  const requestFailed = networkLog.currentState === NetworkEvent.LoadingFailed;
  const dataFetchFailure = requestFailed && !responseData;

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
            disabled={dataFetchFailure}>
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
        {dataFetchFailure ? (
          <div className="response-tab-failed-fetch-information">
            <h4>Failed to load response data</h4>
          </div>
        ) : (
          <HighlightedCodeBlock
            content={responseData}
            language={language}
            theme={editorThemeData}
            placeholder="No response body"
          />
        )}
      </div>
    </>
  );
};

export default ResponseTab;
