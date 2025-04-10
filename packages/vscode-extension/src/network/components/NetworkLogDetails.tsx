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

const VSCODE_TABS_HEADER_HEIGHT = 35;

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

// TODO: Add a close button to the tab bar
const NetworkLogDetails = ({ networkLog, handleClose, parentHeight }: NetworkLogDetailsProps) => {
  return (
    <VscodeTabs>
      {TABS.map(({ title, Tab }) => (
        <Fragment key={title}>
          <VscodeTabHeader>{title}</VscodeTabHeader>
          <VscodeTabPanel>
            <VscodeScrollable
              style={{
                height: parentHeight ? parentHeight - VSCODE_TABS_HEADER_HEIGHT : undefined,
              }}>
              <Tab networkLog={networkLog} />
            </VscodeScrollable>
          </VscodeTabPanel>
        </Fragment>
      ))}
    </VscodeTabs>
  );
};

export default NetworkLogDetails;
