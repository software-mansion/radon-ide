import "./NetworkLogDetails.css";
import {
  VscodeScrollable,
  VscodeTabHeader,
  VscodeTabPanel,
  VscodeTabs,
} from "@vscode-elements/react-elements";
import { Fragment, useEffect, useState } from "react";
import HeadersTab from "./Tabs/HeadersTab";
import PayloadTab from "./Tabs/PayloadTab";
import ResponseTab from "./Tabs/ResponseTab";
import TimingTab from "./Tabs/TimingTab";
import { useNetwork } from "../providers/NetworkProvider";
import { NetworkLog } from "../types/networkLog";
import { ResponseBodyData } from "../types/network";
import { ThemeData } from "../../utilities/themeExtraction";
import useThemeExtractor from "../hooks/useThemeExtractor";

const VSCODE_TABS_HEADER_HEIGHT = 30;

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  handleClose: () => void;
  parentHeight: number | undefined;
}

interface TabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
  editorThemeData?: ThemeData;
}

interface Tab {
  title: string;
  props?: Omit<TabProps, "networkLog">;
  warning?: boolean;
  Tab: React.FC<TabProps>;
}

const NetworkLogDetails = ({ networkLog, handleClose, parentHeight }: NetworkLogDetailsProps) => {
  const [responseBodyData, setResponseBodyData] = useState<ResponseBodyData | undefined>(undefined);
  const { wasTruncated = false } = responseBodyData || {};
  const { getResponseBody } = useNetwork();

  const themeData = useThemeExtractor();

  useEffect(() => {
    getResponseBody(networkLog).then((data) => {
      setResponseBodyData(data);
    });
  }, [networkLog.requestId]);

  const TABS: Tab[] = [
    {
      title: "Headers",
      Tab: HeadersTab,
    },
    {
      title: "Payload",
      Tab: PayloadTab,
      props: { editorThemeData: themeData },
    },
    {
      title: "Response",
      Tab: ResponseTab,
      props: { responseBodyData, editorThemeData: themeData },
      warning: wasTruncated,
    },
    {
      title: "Timing",
      Tab: TimingTab,
    },
  ];

  return (
    <>
      {/* TODO: use VscodeToolbarButton when it will be available in @vscode-elements/react-elements  */}
      <button className="network-log-details-close-button" onClick={handleClose}>
        <span className="codicon codicon-close" />
      </button>
      <VscodeTabs>
        {TABS.map(({ title, Tab, props, warning }) => (
          <Fragment key={title}>
            <VscodeTabHeader className="network-log-details-tab-header">
              <div>
                {title}
                {warning && <span className="codicon codicon-warning" />}
              </div>
            </VscodeTabHeader>
            <VscodeTabPanel>
              <VscodeScrollable
                style={{
                  height: parentHeight ? parentHeight - VSCODE_TABS_HEADER_HEIGHT : undefined,
                }}>
                <div className="network-log-details-tab">
                  <Tab networkLog={networkLog} {...props} />
                </div>
              </VscodeScrollable>
            </VscodeTabPanel>
          </Fragment>
        ))}
      </VscodeTabs>
    </>
  );
};

export default NetworkLogDetails;
