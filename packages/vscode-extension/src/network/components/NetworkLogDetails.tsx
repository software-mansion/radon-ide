import "./NetworkLogDetails.css";
import { VscodeTabHeader, VscodeTabPanel, VscodeTabs } from "@vscode-elements/react-elements";
import { Fragment } from "react";
import HeadersTab from "./HeadersTab";
import PayloadTab from "./PayloadTab";
import ResponseTab from "./ResponseTab";
import TimingTab from "./TimingTab";
import { NetworkLog } from "../hooks/useNetworkTracker";

interface NetworkLogDetailsProps {
  networkLog: NetworkLog;
  containerWidth: number;
  handleClose: () => void;
  setContainerWidth: (width: number) => void;
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

const NetworkLogDetails = ({
  networkLog,
  containerWidth,
  setContainerWidth,
  handleClose,
}: NetworkLogDetailsProps) => {
  return (
    <div className="network-log-details">
      <VscodeTabs>
        {TABS.map(({ title, Tab }) => (
          <Fragment key={title}>
            <VscodeTabHeader>{title}</VscodeTabHeader>
            <VscodeTabPanel>
              <Tab networkLog={networkLog} />
            </VscodeTabPanel>
          </Fragment>
        ))}
      </VscodeTabs>
    </div>
  );
};

export default NetworkLogDetails;
