import { useEffect, useState } from "react";
import IconButton from "./shared/IconButton";
import { ProjectInterface } from "../../common/Project";
import UrlSelect from "./UrlSelect";

interface UrlBarProps {
  project: ProjectInterface;
  disabled?: boolean;
}

function UrlBar({ project, disabled }: UrlBarProps) {
  const [urlList, setUrlList] = useState<{ name: string; id: string }[]>([]);

  useEffect(() => {
    function handleNavigationChanged(navigationData: { displayName: string; id: string }) {
      const newRecord = { name: navigationData.displayName, id: navigationData.id };
      setUrlList((urlList) => [
        newRecord,
        ...urlList.filter((record) => record.id !== newRecord.id),
      ]);
    }
    project.addOrReplaceListener("navigationChanged", handleNavigationChanged);
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
        disabled={disabled || urlList.length < 2}
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
        }}
        disabled={disabled}>
        <span className="codicon codicon-refresh" />
      </IconButton>
      <UrlSelect
        onValueChange={(value: string) => {
          project.openNavigation(value);
        }}
        items={urlList}
        value={urlList[0]?.id}
        disabled={disabled || urlList.length < 1}
      />
    </>
  );
}

export default UrlBar;
