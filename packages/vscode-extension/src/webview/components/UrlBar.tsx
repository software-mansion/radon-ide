import { useEffect, useState, useMemo } from "react";
import IconButton from "./shared/IconButton";
import { ProjectInterface, ProjectState } from "../../common/Project";
import UrlSelect from "./UrlSelect";
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
  const MAX_LAST_SELECTED_URLS_SIZE = 5;
  const [urlList, setUrlList] = useState<{ name: string; id: string }[]>([]);
  const [recentUrlList, setRecentUrlList] = useState<{ name: string; id: string }[]>([]);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);

  useEffect(() => {
    function handleNavigationChanged(navigationData: { displayName: string; id: string }) {
      if (navigationData.id === "{}") {
        return;
      }

      function removeDynamicPostfix(url: string): string {
        return url.split("?")[0];
      }

      const newRecord = {
        name: removeDynamicPostfix(navigationData.displayName),
        id: navigationData.id,
      };
      const isNotInHistory = !urlHistory.length || urlHistory[0] !== newRecord.id;

      setUrlList((urls) => [newRecord, ...urls.filter((record) => record.id !== newRecord.id)]);
      setRecentUrlList((recentUrls) => {
        const filteredRecentUrls = [
          newRecord,
          ...recentUrls.filter((record) => record.id !== newRecord.id),
        ];
        return filteredRecentUrls.length > MAX_LAST_SELECTED_URLS_SIZE
          ? filteredRecentUrls.slice(0, MAX_LAST_SELECTED_URLS_SIZE)
          : filteredRecentUrls;
      });

      if (isNotInHistory) {
        setUrlHistory((prevUrlHistory) => {
          const updatedUrlHistory = [newRecord.id, ...prevUrlHistory];
          return updatedUrlHistory.length > MAX_URL_HISTORY_SIZE
            ? updatedUrlHistory.slice(0, MAX_URL_HISTORY_SIZE)
            : updatedUrlHistory;
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

  const sortedUrlList = useMemo(() => {
    return [...urlList].sort((a, b) => a.name.localeCompare(b.name));
  }, [urlList]);

  useEffect(() => {
    if (resetUrlHistory) {
      setUrlHistory(() => []);
      setRecentUrlList(() => []);
      setUrlList(() => []);
    }
  }, [resetUrlHistory]);

  return (
    <>
      <IconButton
        tooltip={{
          label: "Go back",
          side: "bottom",
        }}
        disabled={disabled}
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
        recentItems={recentUrlList}
        items={sortedUrlList}
        value={urlList[0]?.id}
        disabled={disabled || urlList.length < 1}
      />
    </>
  );
}

export default UrlBar;
