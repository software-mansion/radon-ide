import { useEffect, useState } from "react";
import IconButton from "./shared/IconButton";
import { ProjectInterface, ProjectState } from "../../common/Project";
import UrlSelect from "./UrlSelect";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { IconButtonWithOptions } from "./IconButtonWithOptions";

interface UrlBarProps {
  project: ProjectInterface;
  disabled?: boolean;
  resetUrlHistory?: boolean;
}

interface ReloadButtonProps {
  project: ProjectInterface;
  disabled: boolean;
}

function ReloadButton({ project, disabled }: ReloadButtonProps) {
  return (
    <IconButtonWithOptions
      onClick={() => project.restart(false)}
      tooltip={{
        label: "Reload the app",
        side: "bottom",
      }}
      disabled={disabled}
      options={{
        "Hot reload": () => project.reload("hotReload"),
        "Restart app process": () => project.reload("restartProcess"),
        "Reinstall app": () => project.reload("reinstall"),
        "Clean rebuild": () => project.restart(true),
      }}>
      <span className="codicon codicon-refresh" />
    </IconButtonWithOptions>
  );
}

function UrlBar({ project, disabled, resetUrlHistory }: UrlBarProps) {
  const MAX_URL_HISTORY_SIZE = 20;
  const [urlList, setUrlList] = useState<{ name: string; id: string }[]>([]);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);

  useEffect(() => {
    function handleNavigationChanged(navigationData: { displayName: string; id: string }) {
      const newRecord = { name: navigationData.displayName, id: navigationData.id };
      setUrlList((urlList) => [
        newRecord,
        ...urlList.filter((record) => record.id !== newRecord.id),
      ]);

      if (
        newRecord.id !== "{}" &&
        (!urlHistory.length || (urlHistory.length > 0 && urlHistory[0] !== newRecord.id))
      ) {
        setUrlHistory((prevUrlHistory) => {
          const updatedUrlHistory = [newRecord.id, ...prevUrlHistory];
          if (updatedUrlHistory.length > MAX_URL_HISTORY_SIZE) {
            updatedUrlHistory.pop();
          }
          return updatedUrlHistory;
        });
      }
    }
    project.addListener("navigationChanged", handleNavigationChanged);
    const handleProjectReset = (e: ProjectState) => {
      if (e.status === "starting") {
        setUrlList([]);
      }
    };
    project.addListener("projectStateChanged", handleProjectReset);
    return () => {
      project.removeListener("navigationChanged", handleNavigationChanged);
      project.removeListener("projectStateChanged", handleProjectReset);
    };
  }, [urlHistory]);

  useEffect(() => {
    if (resetUrlHistory) {
      setUrlHistory((prevUrlHistory) => []);
    }
  }, [resetUrlHistory]);

  return (
    <>
      <IconButton
        tooltip={{
          label: "Go back",
          side: "bottom",
        }}
        disabled={disabled || urlHistory.length < 2}
        onClick={() => {
          setUrlHistory((prevUrlHistory) => {
            const newUrlHistory = prevUrlHistory.slice(1);
            project.openNavigation(newUrlHistory[0]);
            return newUrlHistory;
          });
        }}>
        <span className="codicon codicon-arrow-left" />
      </IconButton>
      <ReloadButton project={project} disabled={disabled ?? false} />
      <IconButton
        onClick={() => {
          project.goHome();
        }}
        tooltip={{
          label: "Go to main screen",
          side: "bottom",
        }}
        disabled={disabled || urlList.length === 0}>
        <span className="codicon codicon-home" />
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
