import ShikiHighlighter from "react-shiki";
import { NetworkLog } from "../../types/networkLog";
import { getRequestPayload } from "../../utils/requestFormatters";
import TabActionButtons from "./TabActionButtons";
import "./PayloadAndResponseTab.css";
import { ThemeData } from "../../types/theme";
import { getShikiThemeId } from "../../utils/theme";

interface PayloadTabProps {
  networkLog: NetworkLog;
  editorThemeData?: ThemeData;
}

const NO_PAYLOAD_MESSAGE = "No request body";


const PayloadTab = ({ networkLog, editorThemeData }: PayloadTabProps) => {
  if (!networkLog.request) {
    return null;
  }

  const payloadData = getRequestPayload(networkLog);

  return (
    <>
      <TabActionButtons data={payloadData} disabled={!payloadData} />
      <ShikiHighlighter
        theme={editorThemeData ? getShikiThemeId(editorThemeData) : "none"}
        language={"json"}
        showLanguage={false}
        addDefaultStyles={false}
        className="response-tab-pre"
        >
        {payloadData ?? NO_PAYLOAD_MESSAGE}
      </ShikiHighlighter>
    </>
  );
};

export default PayloadTab;
