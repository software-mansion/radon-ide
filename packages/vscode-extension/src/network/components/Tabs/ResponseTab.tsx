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
}

interface ResponseBodyContentProps {
  wasTruncated: boolean;
  dataFetchFailure: boolean;
  responseData: string | undefined;
  language: string;
  editorThemeData?: ThemeData;
  base64Encoded: boolean;
}

function ResponseTooLargeWarning() {
  return (
    <pre className="response-tab-truncated-warning">
      <span className="codicon codicon-warning" /> Response too large, showing truncated data.
    </pre>
  );
}

const ResponseBodyContent = ({
  wasTruncated,
  dataFetchFailure,
  responseData,
  language,
  editorThemeData,
  base64Encoded,
}: ResponseBodyContentProps) => {
  if (dataFetchFailure) {
    return (
      <div className="response-tab-failed-fetch-information">
        <span className="codicon codicon-info" />
        <h4>Failed to load response data</h4>
      </div>
    );
  }

  // Base64 messages are not truncated by default in ordert
  if (base64Encoded) {
    return (
      <>
        {wasTruncated && <ResponseTooLargeWarning />}
        <pre className="base64-code">{`${responseData}...`}</pre>
      </>
    );
  }

  return (
    <>
      {wasTruncated && <ResponseTooLargeWarning />}
      <HighlightedCodeBlock
        content={`${responseData}...`}
        language={language}
        theme={editorThemeData}
        placeholder="No response body"
      />
    </>
  );
};

const ResponseTab = ({ networkLog, responseBodyData, editorThemeData }: ResponseTabProps) => {
  const { fetchAndOpenResponseInEditor } = useNetwork();
  const { body = undefined, wasTruncated = false, base64Encoded = false } = responseBodyData || {};

  // For images, display the base64-encoded body as-is without formatting
  const responseData = base64Encoded ? body : getFormattedRequestBody(body);

  const contentType =
    networkLog.response?.headers?.[ContentTypeHeader.Default] ||
    networkLog.response?.headers?.[ContentTypeHeader.LowerCase] ||
    "";

  // For base64-encoded images, use plaintext to avoid syntax highlighting
  const language = base64Encoded
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
              fetchAndOpenResponseInEditor(networkLog, base64Encoded);
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
          base64Encoded={base64Encoded}
        />
      </div>
    </>
  );
};

export default ResponseTab;
