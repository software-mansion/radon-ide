import "./NetworkLogDetails.css";
import {
  VscodeScrollable,
  VscodeTabHeader,
  VscodeTabPanel,
  VscodeTabs,
} from "@vscode-elements/react-elements";
import { Fragment, useEffect, useState } from "react";
import HeadersTab from "./HeadersTab";
import PayloadTab from "./PayloadTab";
import ResponseTab from "./ResponseTab";
import TimingTab from "./TimingTab";
import { NetworkLog, responseBodyInfo } from "../hooks/useNetworkTracker";
import { useNetwork } from "../providers/NetworkProvider";

const VSCODE_TABS_HEADER_HEIGHT = 30;

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  handleClose: () => void;
  parentHeight: number | undefined;
}

interface TabProps {
  networkLog: NetworkLog;
  responseBody?: responseBodyInfo;
}

interface Tab {
  title: string;
  props?: Omit<TabProps, "networkLog">;
  warning?: boolean;
  Tab: React.FC<TabProps>;
}

const NetworkLogDetails = ({ networkLog, handleClose, parentHeight }: NetworkLogDetailsProps) => {
  const { getResponseBody } = useNetwork();
  const [responseBody, setResponseBody] = useState<responseBodyInfo | undefined>(undefined);

  const { wasTruncated = false } = responseBody || {};

  useEffect(() => {
    
    getResponseBody(networkLog).then((data) => {
      setResponseBody(data);
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
      props: { responseBody },
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
