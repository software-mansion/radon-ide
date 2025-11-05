import { NetworkLog } from "../../types/networkLog";
import { getRequestPayload } from "../../utils/requestFormatters";
import TabActionButtons from "./TabActionButtons";
import HighlightedCodeBlock from "./HighlightedCodeBlock";
import "./PayloadAndResponseTab.css";
import { ThemeData } from "../../../common/theme";

interface PayloadTabProps {
  networkLog: NetworkLog;
  editorThemeData?: ThemeData;
  isActive?: boolean;
}

const PayloadTab = ({ networkLog, editorThemeData, isActive }: PayloadTabProps) => {
  if (!networkLog.request) {
    return null;
  }

  const payloadData = getRequestPayload(networkLog);

  return (
    <>
      <TabActionButtons data={payloadData} disabled={!payloadData} />
      <div className="tab-padding">
        <HighlightedCodeBlock
          content={payloadData}
          language="json"
          theme={editorThemeData}
          placeholder="No request body"
          isActive={isActive}
        />
      </div>
    </>
  );
};

export default PayloadTab;
