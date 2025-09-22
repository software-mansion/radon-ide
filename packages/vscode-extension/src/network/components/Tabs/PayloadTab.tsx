import { NetworkLog } from "../../types/networkLog";
import { getRequestPayload } from "../../utils/requestFormatters";
import TabActionButtons from "./TabActionButtons";
import "./PayloadAndResponseTab.css";

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
      <div className="tab-padding">
      
        <pre className="response-tab-pre">{payloadData ?? NO_PAYLOAD_MESSAGE}</pre>
      </div>
    </>
  );
};

export default PayloadTab;
