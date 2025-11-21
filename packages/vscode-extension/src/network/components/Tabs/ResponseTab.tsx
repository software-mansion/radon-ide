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
import {
  ResponseTooLargeWarning,
  ResponseLoadingInfo,
  ResponseDataFetchFailedInfo,
} from "./ResponseStatusMessages";

interface ResponseTabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
  editorThemeData?: ThemeData;
  isActive?: boolean;
}

interface ResponseBodyContentProps {
  wasTruncated: boolean;
  dataFetchFailed: boolean;
  dataLoading: boolean;
  responseData: string | undefined;
  language: string;
  editorThemeData?: ThemeData;
  base64Encoded: boolean;
  isActive?: boolean;
}

const NO_RESPONSE_PLACEHOLDER = "No response body";

const ResponseBodyContent = ({
  wasTruncated,
  dataFetchFailed,
  dataLoading,
  responseData,
  language,
  editorThemeData,
  base64Encoded,
  isActive,
}: ResponseBodyContentProps) => {
  if (dataFetchFailed) {
    return <ResponseDataFetchFailedInfo />;
  }

  if (dataLoading) {
    return <ResponseLoadingInfo />;
  }

  if (!responseData) {
    return <pre className="response-tab-pre">{NO_RESPONSE_PLACEHOLDER}</pre>;
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
      isActive={isActive}
    />
  );
};

const ResponseTab = ({
  networkLog,
  responseBodyData,
  editorThemeData,
  isActive,
}: ResponseTabProps) => {
  const { fetchAndOpenResponseInEditor } = useNetwork();

  const { body, wasTruncated = false, base64Encoded = false } = responseBodyData || {};

  // For images, display the base64-encoded body as-is without formatting
  const responseData = base64Encoded ? body : getFormattedRequestBody(body);
  const contentType = getNetworkResponseContentType(networkLog.response);

  /** Determine language for syntax highlighting */
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
  const requestLoading =
    networkLog.currentState !== NetworkEvent.LoadingFinished &&
    networkLog.currentState !== NetworkEvent.LoadingFailed;
  const dataFetchFailed = requestFailed && !responseData;

  const handleOpenInEditor = () => {
    fetchAndOpenResponseInEditor(networkLog, base64Encoded);
  };

  return (
    <>
      <TabActionButtons
        data={responseData}
        disabled={!responseData || requestLoading}
        additionalButtons={
          <IconButton
            className="response-tab-copy-button"
            tooltip={{ label: "Open response in editor", side: "bottom" }}
            onClick={handleOpenInEditor}
            disabled={dataFetchFailed || requestLoading}>
            <span className="codicon codicon-chrome-restore" />
          </IconButton>
        }
      />
      <div className="tab-padding">
        <ResponseBodyContent
          wasTruncated={wasTruncated}
          dataFetchFailed={dataFetchFailed}
          dataLoading={requestLoading}
          responseData={responseData}
          language={language}
          editorThemeData={editorThemeData}
          base64Encoded={base64Encoded}
          isActive={isActive}
        />
      </div>
    </>
  );
};

export default ResponseTab;
