import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { useEffect, useState } from "react";
import IconButton from "./shared/IconButton";
import { ProjectInterface } from "../../common/Project";

function UrlBar({ project }: { project: ProjectInterface }) {
  const [urlList, setUrlList] = useState<{ name: string; id: string }[]>([]);

  useEffect(() => {
    function handleNavigationChanged(navigationData: { displayName: string; id: string }) {
      const newRecord = { name: navigationData.displayName, id: navigationData.id };
      setUrlList((urlList) => [
        newRecord,
        ...urlList.filter((record) => record.id !== newRecord.id),
      ]);
    }
    project.addListener("navigationChanged", handleNavigationChanged);
    return () => {
      project.removeListener("navigationChanged", handleNavigationChanged);
    };
  }, []);

  return (
    <>
      <IconButton
        tooltip={{
          label: "Go back",
          side: "bottom",
        }}
        disabled={urlList.length < 2}
        onClick={() => {
          project.openNavigation(urlList[1].id);
          // remove first item from the url list
          setUrlList((urlList) => urlList.slice(1));
        }}>
        <span className="codicon codicon-arrow-left" />
      </IconButton>
      <IconButton
        onClick={() => project.restart(false)}
        tooltip={{
          label: "Reset the app",
          side: "bottom",
        }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
      <VSCodeDropdown
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          project.openNavigation(target.value);
        }}>
        {urlList.map((entry) => (
          <VSCodeOption key={entry.id} value={entry.id}>
            {entry.name}
          </VSCodeOption>
        ))}
      </VSCodeDropdown>
    </>
  );
}

export default UrlBar;
