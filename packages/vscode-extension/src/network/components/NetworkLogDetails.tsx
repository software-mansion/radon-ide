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
import { ThemeData, ThemeType } from "../types/theme";

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
  const { getResponseBody } = useNetwork();
  const [editorThemeData, setEditorThemeData] = useState<ThemeData | undefined>(undefined);
  const [responseBodyData, setResponseBodyData] = useState<ResponseBodyData | undefined>(undefined);

  const { wasTruncated = false } = responseBodyData || {};

  useEffect(() => {


    const body = document.querySelector("body");
    if (!body) {
      return;
    }

    const themeTypeAttibute = "data-vscode-theme-kind";
    const themeIdAttribute = "data-vscode-theme-id";

    const classObserver = new MutationObserver((mutations) => {
      mutations.forEach((mut) => {
        if (
          mut.type !== "attributes" &&
          mut.attributeName !== themeTypeAttibute &&
          mut.attributeName !== themeIdAttribute
        ) {
          return;
        }

        const newThemeData = {
          themeType: body.getAttribute(themeTypeAttibute) as ThemeType,
          themeName: body.getAttribute(themeIdAttribute) || "",
        };

        setEditorThemeData(prev => {
          if (
            prev?.themeName === newThemeData.themeName &&
            prev?.themeType === newThemeData.themeType
          ) {
            return prev;
          }
          return newThemeData;
        });
      });
    });

    classObserver.observe(body, { attributes: true });

    const initialThemeData: ThemeData = {
      themeType: body.getAttribute(themeTypeAttibute) as ThemeData["themeType"],
      themeName: body.getAttribute(themeIdAttribute) || "",
    };

    setEditorThemeData(initialThemeData);

    return () => classObserver.disconnect();
  }, []);

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
      props: { editorThemeData }
    },
    {
      title: "Response",
      Tab: ResponseTab,
      props: { responseBodyData, editorThemeData },
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
                {<span className="mtk17">{title}</span>}
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
