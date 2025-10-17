import "./NetworkLogDetails.css";
import { VscodeTabHeader, VscodeTabPanel, VscodeTabs } from "@vscode-elements/react-elements";
import { type VscodeTabHeader as VscodeTabHeaderElement } from "@vscode-elements/elements/dist/vscode-tab-header/vscode-tab-header.js";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { VscTabsSelectEvent } from "@vscode-elements/elements/dist/vscode-tabs/vscode-tabs";
import HeadersTab from "./Tabs/HeadersTab";
import PayloadTab from "./Tabs/PayloadTab";
import ResponseTab from "./Tabs/ResponseTab";
import PreviewTab from "./Tabs/PreviewTab";
import TimingTab from "./Tabs/TimingTab";
import TabScrollable from "./Tabs/TabScrollable";
import { useNetwork } from "../providers/NetworkProvider";
import { NetworkLog } from "../types/networkLog";
import { ResponseBodyData, ResponseBodyDataType } from "../types/network";
import { ThemeData } from "../../common/theme";
import useThemeExtractor from "../hooks/useThemeExtractor";
import "overlayscrollbars/overlayscrollbars.css";
import { NetworkEvent } from "../types/panelMessageProtocol";
import InfoBar from "./Tabs/InfoBar";
import { useLogDetailsBar } from "../providers/LogDetailsBar";

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
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const { infoBarHeight } = useLogDetailsBar();

  const [responseBodyData, setResponseBodyData] = useState<ResponseBodyData | undefined>(undefined);
  const { wasTruncated = false, type = ResponseBodyDataType.Other } = responseBodyData || {};
  const { getResponseBody } = useNetwork();

  const themeData = useThemeExtractor();
  const isImage = type === ResponseBodyDataType.Image;

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

  // Define tabs with stable indices - memoized to prevent unnecessary recalculations
  const tabs: Tab[] = useMemo(
    () => [
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
    ],
    [themeData, responseBodyData, isImage, wasTruncated]
  );

  const calculateScrollableHeight = () => {
    const header = headerRef.current;

    if (!parentHeight || !header) {
      return 0;
    }

    const headerHeight = header.clientHeight;
    return parentHeight - headerHeight - infoBarHeight;
  };

  /**
   * Handle tab visibility changes - currently only Preview tab case
   */
  useEffect(() => {
    const currentTab = tabs[selectedTabIndex];
    if (currentTab?.title === "Preview" && currentTab.hideTab) {
      // Switch Preview tab to Response tab
      const responseTabIndex = tabs.findIndex((tab) => tab.title === "Response");
      const updatedIndex = responseTabIndex !== -1 ? responseTabIndex : 0;
      setSelectedTabIndex(updatedIndex);
    }
  }, [tabs, selectedTabIndex]);

  const handleVscTabsSelect = ({ detail }: VscTabsSelectEvent) =>
    setSelectedTabIndex(detail.selectedIndex);

  return (
    <Fragment>
      {/* TODO: use VscodeToolbarButton when it will be available in @vscode-elements/react-elements  */}
      <button className="network-log-details-close-button" onClick={handleClose}>
        <span className="codicon codicon-close" />
      </button>
      <VscodeTabs
        data-testid="network-panel-log-details-tabs"
        selectedIndex={selectedTabIndex}
        onVscTabsSelect={handleVscTabsSelect}>
        {tabs.map(({ title, Tab, props, warning, hideTab }, index) => (
          <Fragment key={title}>
            <VscodeTabHeader
              ref={headerRef}
              className="network-log-details-tab-header"
              style={{ display: hideTab ? "none" : "flex" }}
              data-testid={`network-panel-tab-header-${title.toLowerCase()}`}>
              <div>
                {title}
                {warning && <span className="codicon codicon-warning" />}
              </div>
            </VscodeTabHeader>
            <VscodeTabPanel data-testid={`network-panel-tab-panel-${title.toLowerCase()}`}>
              {index === selectedTabIndex && (
                <>
                  <TabScrollable height={calculateScrollableHeight()}>
                    <Tab networkLog={networkLog} {...props} />
                  </TabScrollable>
                  <InfoBar />
                </>
              )}
            </VscodeTabPanel>
          </Fragment>
        ))}
      </VscodeTabs>
    </Fragment>
  );
};

export default NetworkLogDetails;
