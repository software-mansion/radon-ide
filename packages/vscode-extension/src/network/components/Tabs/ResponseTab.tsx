import { useNetwork } from "../../providers/NetworkProvider";
import {
  determineLanguage,
  getFormattedRequestBody,
  getNetworkResponseContentType,
} from "../../utils/requestFormatters";
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

interface ResponseBodyContentProps {
  wasTruncated: boolean;
  dataFetchFailed: boolean;
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

const NO_RESPONSE_PLACEHOLDER = "No response body";

const ResponseBodyContent = ({
  wasTruncated,
  dataFetchFailed,
  responseData,
  language,
  editorThemeData,
  base64Encoded,
}: ResponseBodyContentProps) => {
  if (dataFetchFailed) {
    return (
      <div className="response-tab-failed-fetch-information">
        <span className="codicon codicon-info" />
        <h4>Failed to load response data</h4>
      </div>
    );
  }

  if (!responseData) {
    return <pre className="response-tab-no-data">{NO_RESPONSE_PLACEHOLDER}</pre>;
  }

  // Base64 messages are not truncated by default in order to allow viewing full images/files
  if (base64Encoded) {
    return (
      <>
        {wasTruncated && <ResponseTooLargeWarning />}
        <pre className="base64-code">{wasTruncated ? `${responseData}...` : responseData}</pre>
      </>
    );
  }

  if (wasTruncated) {
    return (
      <>
        <ResponseTooLargeWarning />
        {`${responseData}...`}
      </>
    );
  }

  return (
    <HighlightedCodeBlock
      content={responseData}
      language={language}
      theme={editorThemeData}
      placeholder={NO_RESPONSE_PLACEHOLDER}
    />
  );
};

const ResponseTab = ({ networkLog, responseBodyData, editorThemeData }: ResponseTabProps) => {
  const { fetchAndOpenResponseInEditor } = useNetwork();
  const { body = undefined, wasTruncated = false, base64Encoded = false } = responseBodyData || {};

  // For images, display the base64-encoded body as-is without formatting
  const responseData = base64Encoded ? body : getFormattedRequestBody(body);
  const contentType = getNetworkResponseContentType(networkLog.response);

  // Determine language for syntax highlighting
  const getLanguage = (): string => {
    if (base64Encoded) {
      return "plaintext";
    }
    if (responseData) {
      return determineLanguage(contentType, responseData);
    }
    return "plaintext";
  };

  const language = getLanguage();

  const requestFailed = networkLog.currentState === NetworkEvent.LoadingFailed;
  const dataFetchFailed = requestFailed && !responseData;

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
            disabled={dataFetchFailed}>
            <span className="codicon codicon-chrome-restore" />
          </IconButton>
        }
      />
      <div className="tab-padding">
        <ResponseBodyContent
          wasTruncated={wasTruncated}
          dataFetchFailed={dataFetchFailed}
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
