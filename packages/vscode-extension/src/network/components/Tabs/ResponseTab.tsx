import ShikiHighlighter from "react-shiki";
import { useNetwork } from "../../providers/NetworkProvider";
import { determineLanguage, getFormattedRequestBody } from "../../utils/requestFormatters";
import IconButton from "../../../webview/components/shared/IconButton";
import TabActionButtons from "./TabActionButtons";
import { ResponseBodyData } from "../../types/network";
import { NetworkLog } from "../../types/networkLog";
import "./PayloadAndResponseTab.css";
import { ThemeData } from "../../types/theme";
import { getShikiThemeId } from "../../utils/theme";

interface ResponseTabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
  editorThemeData?: ThemeData;
}

const NO_RESPONSE_MESSAGE = "No response body";

const ResponseTab = ({ networkLog, responseBodyData, editorThemeData }: ResponseTabProps) => {
  const { fetchAndOpenResponseInEditor } = useNetwork();
  const { body = undefined, wasTruncated = false } = responseBodyData || {};
  const responseData = getFormattedRequestBody(body);
  const contentType = networkLog.response?.headers?.["Content-Type"] || "";

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
      {wasTruncated && (
        <pre className="response-tab-truncated-warning">
          <span className="codicon codicon-warning" /> Response too large, showing truncated data.
        </pre>
      )}
      <ShikiHighlighter
        theme={editorThemeData ? getShikiThemeId(editorThemeData) : "none"}
        language={responseData ? determineLanguage(contentType, responseData) : "plaintext"}
        showLanguage={false}
        addDefaultStyles={false}
        className="response-tab-pre">
        {responseData ?? NO_RESPONSE_MESSAGE}
      </ShikiHighlighter>
    </>
  );
};

export default ResponseTab;
