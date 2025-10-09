import { useNetwork } from "../../providers/NetworkProvider";
import { determineLanguage, getFormattedRequestBody } from "../../utils/requestFormatters";
import IconButton from "../../../webview/components/shared/IconButton";
import TabActionButtons from "./TabActionButtons";
import HighlightedCodeBlock from "./HighlightedCodeBlock";
import { ResponseBodyData } from "../../types/network";
import { NetworkLog } from "../../types/networkLog";
import "./PayloadAndResponseTab.css";
import { ThemeData } from "../../../common/theme";
import { ContentTypeHeader } from "../../types/network";
import { NetworkEvent } from "../../types/panelMessageProtocol";

interface ResponseTabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
  editorThemeData?: ThemeData;
  isImage?: boolean;
}

interface ResponseBodyContentProps {
  wasTruncated: boolean;
  dataFetchFailure: boolean;
  responseData: string | undefined;
  language: string;
  editorThemeData?: ThemeData;
  isImage?: boolean;
  base64Encoded: boolean;
}

const ResponseBodyContent = ({
  wasTruncated,
  dataFetchFailure,
  responseData,
  language,
  editorThemeData,
  isImage,
  base64Encoded,
}: ResponseBodyContentProps) => {
  if (wasTruncated) {
    return (
      <>
        <pre className="response-tab-truncated-warning">
          <span className="codicon codicon-warning" /> Response too large, showing truncated data.
        </pre>
        <HighlightedCodeBlock
          content={responseData}
          language={language}
          theme={editorThemeData}
          placeholder="No response body"
          className={isImage && base64Encoded ? "response-tab-base64-wrap" : "response-tab-pre"}
        />
      </>
    );
  }

  if (dataFetchFailure) {
    return (
      <div className="response-tab-failed-fetch-information">
        <span className="codicon codicon-info" />
        <h4>Failed to load response data</h4>
      </div>
    );
  }

  return (
    <HighlightedCodeBlock
      content={responseData}
      language={language}
      theme={editorThemeData}
      placeholder="No response body"
      className={isImage && base64Encoded ? "response-tab-base64-wrap" : "response-tab-pre"}
    />
  );
};

const ResponseTab = ({
  networkLog,
  responseBodyData,
  editorThemeData,
  isImage,
}: ResponseTabProps) => {
  const { fetchAndOpenResponseInEditor } = useNetwork();
  const { body = undefined, wasTruncated = false, base64Encoded = false } = responseBodyData || {};

  // For images, display the base64-encoded body as-is without formatting
  const responseData = isImage && base64Encoded ? body : getFormattedRequestBody(body);

  const contentType =
    networkLog.response?.headers?.[ContentTypeHeader.IOS] ||
    networkLog.response?.headers?.[ContentTypeHeader.ANDROID] ||
    "";

  // For base64-encoded images, use plaintext to avoid syntax highlighting
  const language =
    isImage && base64Encoded
      ? "plaintext"
      : responseData
        ? determineLanguage(contentType, responseData)
        : "plaintext";

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
        <ResponseBodyContent
          wasTruncated={wasTruncated}
          dataFetchFailure={dataFetchFailure}
          responseData={responseData}
          language={language}
          editorThemeData={editorThemeData}
          isImage={isImage}
          base64Encoded={base64Encoded}
        />
      </div>
    </>
  );
};

export default ResponseTab;
