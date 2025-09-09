import { NetworkLog } from "../hooks/useNetworkTracker";
import { formatJSONBody, formatUrlParams } from "../utils/requestFormatUtils";
import TabActionButtons from "./TabActionButtons";

interface PayloadTabProps {
  networkLog: NetworkLog;
}

const NO_PAYLOAD_MESSAGE = "No request body";

const PayloadTab = ({ networkLog }: PayloadTabProps) => {
  if (!networkLog.request) {
    return null;
  }

  const getPayloadData = (): string | undefined => {
    const { url, postData } = networkLog.request!;

    const urlParams = formatUrlParams(url);
    const hasUrlParams = urlParams !== "{}";

    if (postData && postData !== "") {
      const bodyData = formatJSONBody(postData);

      if (hasUrlParams) {
        return `URL Parameters:\n${urlParams}\n\nRequest Body:\n${bodyData}`;
      }
      return bodyData;
    }

    if (hasUrlParams) {
      return urlParams;
    }

    return undefined;
  };

  const payloadData = getPayloadData();

  return (
    <>
      <TabActionButtons data={payloadData} disabled={!payloadData} />
      <pre className="response-tab-pre">{payloadData ?? NO_PAYLOAD_MESSAGE}</pre>
    </>
  );
};

export default PayloadTab;
