import "./NetworkLogDetails.css";
import { VscodeTabHeader, VscodeTabPanel, VscodeTabs } from "@vscode-elements/react-elements";
import { type VscodeTabHeader as VscodeTabHeaderElement } from "@vscode-elements/elements/dist/vscode-tab-header/vscode-tab-header.js";
import { Fragment, useEffect, useRef, useState } from "react";
import HeadersTab from "./Tabs/HeadersTab";
import PayloadTab from "./Tabs/PayloadTab";
import ResponseTab from "./Tabs/ResponseTab";
import PreviewTab from "./Tabs/PreviewTab";
import TimingTab from "./Tabs/TimingTab";
import TabScrollable from "./Tabs/TabScrollable";
import { useNetwork } from "../providers/NetworkProvider";
import { NetworkLog } from "../types/networkLog";
import { ResponseBodyData } from "../types/network";
import { ThemeData } from "../../common/theme";
import useThemeExtractor from "../hooks/useThemeExtractor";
import "overlayscrollbars/overlayscrollbars.css";
import { NetworkEvent } from "../types/panelMessageProtocol";
// import InfoBar from "./Tabs/InfoBar";

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  handleClose: () => void;
  parentHeight: number | undefined;
}

interface TabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
  editorThemeData?: ThemeData;
  isImage?: boolean;
}

interface Tab {
  title: string;
  props?: Omit<TabProps, "networkLog">;
  warning?: boolean;
  Tab: React.FC<TabProps>;
  hideTab?: boolean;
}

const NetworkLogDetails = ({ networkLog, handleClose, parentHeight }: NetworkLogDetailsProps) => {
  const headerRef = useRef<VscodeTabHeaderElement>(null);
  const selectedTabIndexRef = useRef(0);

  const [responseBodyData, setResponseBodyData] = useState<ResponseBodyData | undefined>(undefined);
  const { wasTruncated = false } = responseBodyData || {};
  const { getResponseBody } = useNetwork();

  const themeData = useThemeExtractor();
  const isImage = networkLog.type === "Image";
  const selectedTabIndex = selectedTabIndexRef.current;

  useEffect(() => {
    if (
      networkLog.currentState === NetworkEvent.LoadingFinished ||
      networkLog.currentState === NetworkEvent.LoadingFailed
    ) {
      getResponseBody(networkLog).then((data) => {
        setResponseBodyData(data);
      });
    }
  }, [networkLog.requestId, networkLog.currentState]);

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
      title: "Preview",
      Tab: PreviewTab,
      props: { responseBodyData },
      hideTab: !isImage,
    },
    {
      title: "Response",
      Tab: ResponseTab,
      props: { responseBodyData, editorThemeData: themeData, isImage },
      warning: wasTruncated,
    },
    {
      title: "Timing",
      Tab: TimingTab,
    },
  ];

  const calculateScrollableHeight = () => {
    const header = headerRef.current;

    if (!parentHeight || !header) {
      return 0;
    }
    const headerHeight = header.clientHeight;
    return parentHeight - headerHeight;
  };

  return (
    <Fragment key={networkLog.requestId}>
      {/* TODO: use VscodeToolbarButton when it will be available in @vscode-elements/react-elements  */}
      <button className="network-log-details-close-button" onClick={handleClose}>
        <span className="codicon codicon-close" />
      </button>
      <VscodeTabs
        data-testid="network-panel-log-details-tabs"
        selectedIndex={selectedTabIndex}
        onVscTabsSelect={({ detail }) => (selectedTabIndexRef.current = detail.selectedIndex)}>
        {TABS.map(
          ({ title, Tab, props, warning, hideTab }) =>
            !hideTab && (
              <Fragment key={`${title}`}>
                <VscodeTabHeader
                  ref={headerRef}
                  className="network-log-details-tab-header"
                  data-testid={`network-panel-tab-header-${title.toLowerCase()}`}>
                  <div>
                    {title}
                    {warning && <span className="codicon codicon-warning" />}
                  </div>
                </VscodeTabHeader>
                <VscodeTabPanel data-testid={`network-panel-tab-panel-${title.toLowerCase()}`}>
                  {/* <div style={{ height: `${height - 40}px`, overflow: "hidden" }}> */}
                  <TabScrollable height={calculateScrollableHeight()}>
                    <Tab networkLog={networkLog} {...props} />
                  </TabScrollable>
                  {/* </div> */}
                  {/* <InfoBar
                ref={infoBarRef}
                data={{
                  method: networkLog.request?.method || "Unknown",
                  status: networkLog.response?.status?.toString() || "Unknown",
                  type: networkLog.response?.headers?.["Content-Type"] || "Unknown",
                }}
              /> */}
                </VscodeTabPanel>
              </Fragment>
            )
        )}
      </VscodeTabs>
    </Fragment>
  );
};

export default NetworkLogDetails;
