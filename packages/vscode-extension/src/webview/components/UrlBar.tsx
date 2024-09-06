import { useEffect, useState, useMemo } from "react";
import IconButton from "./shared/IconButton";
import { ProjectInterface, ProjectState } from "../../common/Project";
import UrlSelect, { UrlItem } from "./UrlSelect";
import { IconButtonWithOptions } from "./IconButtonWithOptions";

interface UrlBarProps {
  project: ProjectInterface;
  disabled?: boolean;
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

function UrlBar({ project, disabled }: UrlBarProps) {
  const MAX_URL_HISTORY_SIZE = 20;
  const MAX_RECENT_URL_SIZE = 5;

  const [urlList, setUrlList] = useState<UrlItem[]>([]);
  const [recentUrlList, setRecentUrlList] = useState<UrlItem[]>([]);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const [homeUrl, setHomeUrl] = useState<string>("");

  useEffect(() => {
    function handleNavigationChanged(navigationData: { displayName: string; id: string }) {
      if (navigationData.displayName === "") {
        return;
      }

      const newRecord = {
        name: navigationData.displayName,
        id: navigationData.id,
      };
      const isNotInHistory = urlHistory.length === 0 || urlHistory[0] !== newRecord.id;

      if (homeUrl === "") {
        setHomeUrl(newRecord.id);
      }

      setUrlList(moveAsMostRecent(urlList, newRecord));
      setUrlList((urls) => [newRecord, ...urls.filter((record) => record.id !== newRecord.id)]);
      setRecentUrlList(() => {
        const updatedRecentUrls = moveAsMostRecent(recentUrlList, newRecord);
        return updatedRecentUrls.slice(0, MAX_RECENT_URL_SIZE);
      });

      if (isNotInHistory) {
        setUrlHistory((prevUrlHistory) => {
          const updatedUrlHistory = [newRecord.id, ...prevUrlHistory];
          return updatedUrlHistory.slice(0, MAX_URL_HISTORY_SIZE);
        });
      }
    }

    project.addListener("navigationChanged", handleNavigationChanged);
    const handleProjectReset = (e: ProjectState) => {
      if (e.status === "starting") {
        setUrlList([]);
        setRecentUrlList([]);
        setUrlHistory([]);
      }
    };
    project.addListener("projectStateChanged", handleProjectReset);
    return () => {
      project.removeListener("navigationChanged", handleNavigationChanged);
      project.removeListener("projectStateChanged", handleProjectReset);
    };
  }, [urlHistory]);

  const sortedUrlList = useMemo(() => {
    return [...urlList].sort((a, b) => a.name.localeCompare(b.name));
  }, [urlList]);

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
          project.goHome(homeUrl);
        }}
        tooltip={{
          label: "Go to main screen",
          side: "bottom",
        }}
        disabled={disabled || urlList.length < 1}>
        <span className="codicon codicon-home" />
      </IconButton>
      <UrlSelect
        onValueChange={(value: string) => {
          project.openNavigation(value);
        }}
        recentItems={recentUrlList}
        items={sortedUrlList}
        value={urlList[0]?.id}
        disabled={disabled || urlList.length < 1}
      />
    </>
  );
}

export default UrlBar;
