import { NetworkLog } from "../hooks/useNetworkTracker";
import { getRequestPayload } from "../utils/requestFormatters";
import TabActionButtons from "./TabActionButtons";

interface PayloadTabProps {
  networkLog: NetworkLog;
}

const NO_PAYLOAD_MESSAGE = "No request body";

const PayloadTab = ({ networkLog }: PayloadTabProps) => {
  if (!networkLog.request) {
    return null;
  }

  const payloadData = getRequestPayload(networkLog);

  return (
    <>
      <TabActionButtons data={payloadData} disabled={!payloadData} />
      <pre className="response-tab-pre">{payloadData ?? NO_PAYLOAD_MESSAGE}</pre>
    </>
  );
};

export default PayloadTab;
