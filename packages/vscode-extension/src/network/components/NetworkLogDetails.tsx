import "./NetworkLogDetails.css";
import {
  VscodeScrollable,
  VscodeTabHeader,
  VscodeTabPanel,
  VscodeTabs,
} from "@vscode-elements/react-elements";
import { Fragment } from "react";
import HeadersTab from "./HeadersTab";
import PayloadTab from "./PayloadTab";
import ResponseTab from "./ResponseTab";
import TimingTab from "./TimingTab";
import { NetworkLog } from "../hooks/useNetworkTracker";

const VSCODE_TABS_HEADER_HEIGHT = 30;

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  handleClose: () => void;
  parentHeight: number | undefined;
}

const TABS = [
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
  },
  {
    title: "Timing",
    Tab: TimingTab,
  },
];

const NetworkLogDetails = ({ networkLog, handleClose, parentHeight }: NetworkLogDetailsProps) => {
  return (
    <>
      {/* TODO: use VscodeToolbarButton when it will be available in @vscode-elements/react-elements  */}
      <button className="network-log-details-close-button" onClick={handleClose}>
        <span className="codicon codicon-close" />
      </button>
      <VscodeTabs>
        {TABS.map(({ title, Tab }) => (
          <Fragment key={title}>
            <VscodeTabHeader className="network-log-details-tab-header">{title}</VscodeTabHeader>
            <VscodeTabPanel>
              <VscodeScrollable
                style={{
                  height: parentHeight ? parentHeight - VSCODE_TABS_HEADER_HEIGHT : undefined,
                }}>
                <div className="network-log-details-tab">
                  <Tab networkLog={networkLog} />
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
