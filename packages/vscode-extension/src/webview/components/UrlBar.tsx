import { useEffect, useState, useMemo } from "react";
import { useProject } from "../providers/ProjectProvider";
import UrlSelect, { UrlItem } from "./UrlSelect";
import { IconButtonWithOptions } from "./IconButtonWithOptions";
import IconButton from "./shared/IconButton";

function ReloadButton({ disabled }: { disabled: boolean }) {
  const { project } = useProject();
  return (
    <IconButtonWithOptions
      onClick={() => project.restart(false)}
      tooltip={{
        label: "Reload the app",
        side: "bottom",
      }}
      disabled={disabled}
      options={{
        "Reload JS": () => project.reload("reloadJs"),
        "Restart app process": () => project.reload("restartProcess"),
        "Reinstall app": () => project.reload("reinstall"),
        "Clear Metro cache": () => project.restart("metro"),
        "Reboot IDE": () => project.reload("reboot"),
        "Clean rebuild": () => project.restart("all"),
      }}>
      <span className="codicon codicon-refresh" />
    </IconButtonWithOptions>
  );
}

function UrlBar({ disabled }: { disabled?: boolean }) {
  const { project, projectState } = useProject();

  const MAX_URL_HISTORY_SIZE = 20;
  const MAX_RECENT_URL_SIZE = 5;

  const [backNavigationPath, setBackNavigationPath] = useState<string>("");
  const [urlList, setUrlList] = useState<UrlItem[]>([]);
  const [recentUrlList, setRecentUrlList] = useState<UrlItem[]>([]);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);

  useEffect(() => {
    function moveAsMostRecent(urls: UrlItem[], newUrl: UrlItem) {
      return [newUrl, ...urls.filter((record) => record.id !== newUrl.id)];
    }

    function handleNavigationChanged(navigationData: { displayName: string; id: string }) {
      if (backNavigationPath && backNavigationPath !== navigationData.id) {
        return;
      }

      const newRecord: UrlItem = {
        name: navigationData.displayName,
        id: navigationData.id,
      };
      const isNotInHistory = urlHistory.length === 0 || urlHistory[0] !== newRecord.id;

      setUrlList((currentUrlList) => moveAsMostRecent(currentUrlList, newRecord));
      setRecentUrlList((currentRecentUrlList) => {
        const updatedRecentUrls = moveAsMostRecent(currentRecentUrlList, newRecord);
        return updatedRecentUrls.slice(0, MAX_RECENT_URL_SIZE);
      });

      if (isNotInHistory) {
        setUrlHistory((currentUrlHistoryList) => {
          const updatedUrlHistory = [newRecord.id, ...currentUrlHistoryList];
          return updatedUrlHistory.slice(0, MAX_URL_HISTORY_SIZE);
        });
      }
      setBackNavigationPath("");
    }

    project.addListener("navigationChanged", handleNavigationChanged);
    return () => {
      project.removeListener("navigationChanged", handleNavigationChanged);
    };
  }, [recentUrlList, urlHistory, backNavigationPath]);

  const sortedUrlList = useMemo(() => {
    return [...urlList].sort((a, b) => a.name.localeCompare(b.name));
  }, [urlList]);

  const disabledAlsoWhenStarting = disabled || projectState.status === "starting";

  return (
    <>
      <IconButton
        tooltip={{
          label: "Go back",
          side: "bottom",
        }}
        disabled={disabledAlsoWhenStarting || urlHistory.length < 2}
        onClick={() => {
          setUrlHistory((prevUrlHistory) => {
            const newUrlHistory = prevUrlHistory.slice(1);
            setBackNavigationPath(newUrlHistory[0]);
            project.openNavigation(newUrlHistory[0]);
            return newUrlHistory;
          });
        }}>
        <span className="codicon codicon-arrow-left" />
      </IconButton>
      <ReloadButton disabled={disabled ?? false} />
      <IconButton
        onClick={() => {
          project.goHome("/{}");
        }}
        tooltip={{
          label: "Go to main screen",
          side: "bottom",
        }}
        disabled={disabledAlsoWhenStarting}>
        <span className="codicon codicon-home" />
      </IconButton>
      <UrlSelect
        onValueChange={(value: string) => {
          project.openNavigation(value);
        }}
        recentItems={recentUrlList}
        items={sortedUrlList}
        value={urlList[0]?.id}
        disabled={disabledAlsoWhenStarting || urlList.length < 2}
      />
    </>
  );
}

export default UrlBar;
