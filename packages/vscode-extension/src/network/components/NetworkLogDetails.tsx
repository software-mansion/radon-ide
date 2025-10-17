import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { VscodeTabHeader, VscodeTabPanel, VscodeTabs } from "@vscode-elements/react-elements";
import { type VscodeTabHeader as VscodeTabHeaderElement } from "@vscode-elements/elements/dist/vscode-tab-header/vscode-tab-header.js";
import { VscTabsSelectEvent } from "@vscode-elements/elements/dist/vscode-tabs/vscode-tabs";
import { NetworkLog } from "../types/networkLog";
import { ResponseBodyData, ResponseBodyDataType } from "../types/network";
import { NetworkEvent } from "../types/panelMessageProtocol";
import { ThemeData } from "../../common/theme";
import { useNetwork } from "../providers/NetworkProvider";
import useThemeExtractor from "../hooks/useThemeExtractor";
import HeadersTab from "./Tabs/HeadersTab";
import PayloadTab from "./Tabs/PayloadTab";
import ResponseTab from "./Tabs/ResponseTab";
import PreviewTab from "./Tabs/PreviewTab";
import TimingTab from "./Tabs/TimingTab";
import TabScrollable from "./Tabs/TabScrollable";
import TabBar from "./Tabs/TabBar";
import "overlayscrollbars/overlayscrollbars.css";
import "./NetworkLogDetails.css";

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  handleClose: () => void;
  parentHeight: number | undefined;
}

interface TabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
  editorThemeData?: ThemeData;
  isActive?: boolean;
}

interface Tab {
  Tab: React.FC<TabProps>;
  title: string;
  props?: Omit<TabProps, "networkLog">;
  warning?: boolean;
  hide?: boolean;
  showTabBar?: boolean;
}

const NetworkLogDetails = ({ networkLog, handleClose, parentHeight }: NetworkLogDetailsProps) => {
  const headerRef = useRef<VscodeTabHeaderElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [responseBodyData, setResponseBodyData] = useState<ResponseBodyData | undefined>(undefined);

  const { getResponseBody } = useNetwork();
  const themeData = useThemeExtractor();

  const { wasTruncated = false, type = ResponseBodyDataType.Other } = responseBodyData || {};
  const isImage = type === ResponseBodyDataType.Image;

  // Fetch response body data when loading completes
  useEffect(() => {
    const isLoadingComplete =
      networkLog.currentState === NetworkEvent.LoadingFinished ||
      networkLog.currentState === NetworkEvent.LoadingFailed;

    if (isLoadingComplete) {
      getResponseBody(networkLog).then(setResponseBodyData);
    }
  }, [networkLog.requestId, networkLog.currentState]);

  // Define tabs configuration
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
        hide: !isImage,
        showTabBar: true,
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
    ],
    [themeData, responseBodyData, isImage, wasTruncated]
  );

  const calculateScrollableHeight = (): number => {
    const header = headerRef.current;
    const tabBarHeight = tabBarRef.current?.clientHeight || 0;

    if (!parentHeight || !header) {
      return 0;
    }

    const headerHeight = header.clientHeight;
    return parentHeight - headerHeight - tabBarHeight;
  };

  // Auto-switch from hidden Preview tab to Response tab
  useEffect(() => {
    const currentTab = tabs[selectedTabIndex];
    if (currentTab?.title === "Preview" && currentTab.hide) {
      const responseTabIndex = tabs.findIndex((tab) => tab.title === "Response");
      const fallbackIndex = responseTabIndex !== -1 ? responseTabIndex : 0;
      setSelectedTabIndex(fallbackIndex);
    }
  }, [tabs, selectedTabIndex]);

  const handleTabSelect = ({ detail }: VscTabsSelectEvent) => {
    setSelectedTabIndex(detail.selectedIndex);
  };

  return (
    <Fragment>
      <button className="network-log-details-close-button" onClick={handleClose}>
        <span className="codicon codicon-close" />
      </button>
      <VscodeTabs
        onVscTabsSelect={handleTabSelect}
        data-testid="network-panel-log-details-tabs"
        selectedIndex={selectedTabIndex}>
        {tabs.map(({ title, Tab, props, warning, hide, showTabBar }, index) => (
          <Fragment key={title}>
            <VscodeTabHeader
              ref={headerRef}
              className="network-log-details-tab-header"
              style={{ display: hide ? "none" : "flex" }}
              data-testid={`network-panel-tab-header-${title.toLowerCase()}`}>
              <div>
                {title}
                {warning && <span className="codicon codicon-warning" />}
              </div>
            </VscodeTabHeader>

            <VscodeTabPanel data-testid={`network-panel-tab-panel-${title.toLowerCase()}`}>
              <TabScrollable height={calculateScrollableHeight()}>
                <Tab networkLog={networkLog} isActive={index === selectedTabIndex} {...props} />
              </TabScrollable>
              {showTabBar && <TabBar ref={tabBarRef} />}
            </VscodeTabPanel>
          </Fragment>
        ))}
      </VscodeTabs>
    </Fragment>
  );
};

export default NetworkLogDetails;
