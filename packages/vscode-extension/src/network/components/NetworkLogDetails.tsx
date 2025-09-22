import "./NetworkLogDetails.css";
import { VscodeTabHeader, VscodeTabPanel, VscodeTabs } from "@vscode-elements/react-elements";
import {type VscodeTabHeader as VscodeTabHeaderElement} from "@vscode-elements/elements/dist/vscode-tab-header/vscode-tab-header.js";
import { Fragment, useEffect, useRef, useState } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import HeadersTab from "./Tabs/HeadersTab";
import PayloadTab from "./Tabs/PayloadTab";
import ResponseTab from "./Tabs/ResponseTab";
import TimingTab from "./Tabs/TimingTab";
import { useNetwork } from "../providers/NetworkProvider";
import { NetworkLog } from "../types/networkLog";
import { ResponseBodyData } from "../types/network";
import "overlayscrollbars/overlayscrollbars.css";

// const VSCODE_TABS_HEADER_HEIGHT = 30;

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  handleClose: () => void;
  parentHeight: number | undefined;
}

interface TabProps {
  networkLog: NetworkLog;
  responseBodyData?: ResponseBodyData;
}

interface Tab {
  title: string;
  props?: Omit<TabProps, "networkLog">;
  warning?: boolean;
  Tab: React.FC<TabProps>;
}

const NetworkLogDetails = ({ networkLog, handleClose, parentHeight }: NetworkLogDetailsProps) => {
  const headerRef = useRef<VscodeTabHeaderElement>(null);
  
  const { getResponseBody } = useNetwork();
  const [responseBodyData, setResponseBodyData] = useState<ResponseBodyData | undefined>(undefined);

  const { wasTruncated = false } = responseBodyData || {};

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
    },
    {
      title: "Response",
      Tab: ResponseTab,
      props: { responseBodyData },
      warning: wasTruncated,
    },
    {
      title: "Timing",
      Tab: TimingTab,
    },
  ];

  const calculateScrollableHeight =  () => {
    const header = headerRef.current;
    if (!parentHeight || !header) {
      return undefined;
    }
    const headerHeight = header.clientHeight;
    return parentHeight - headerHeight;
  }

  return (
    <>
      {/* TODO: use VscodeToolbarButton when it will be available in @vscode-elements/react-elements  */}
      <button className="network-log-details-close-button" onClick={handleClose}>
        <span className="codicon codicon-close" />
      </button>
      <VscodeTabs>
        {TABS.map(({ title, Tab, props, warning }) => (
          <Fragment key={title}>
            <VscodeTabHeader ref={headerRef} className="network-log-details-tab-header">
              <div>
                {title}
                {warning && <span className="codicon codicon-warning" />}
              </div>
            </VscodeTabHeader>
            <VscodeTabPanel>
              <OverlayScrollbarsComponent
                options={{
                  scrollbars: {
                    autoHide: "leave",
                    autoHideDelay: 100,
                    visibility: "auto",
                  },
                }}
                className="network-log-details-tab-scrollable"
                style={{
                  height: calculateScrollableHeight(),
                }}>
                <div className="network-log-details-tab">
                  <Tab networkLog={networkLog} {...props} />
                </div>
              </OverlayScrollbarsComponent>
            </VscodeTabPanel>
          </Fragment>
        ))}
      </VscodeTabs>
    </>
  );
};

export default NetworkLogDetails;
