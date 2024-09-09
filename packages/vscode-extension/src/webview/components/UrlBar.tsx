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
        "Hot reload": () => project.reload("hotReload"),
        "Restart app process": () => project.reload("restartProcess"),
        "Reinstall app": () => project.reload("reinstall"),
        "Clean rebuild": () => project.restart(true),
      }}>
      <span className="codicon codicon-refresh" />
    </IconButtonWithOptions>
  );
}

function UrlBar({ disabled }: { disabled?: boolean }) {
  const { project } = useProject();

  const MAX_URL_HISTORY_SIZE = 20;
  const MAX_RECENT_URL_SIZE = 5;

  const [urlList, setUrlList] = useState<UrlItem[]>([]);
  const [recentUrlList, setRecentUrlList] = useState<UrlItem[]>([]);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);

  useEffect(() => {
    function moveAsMostRecent(urls: UrlItem[], newUrl: UrlItem) {
      return [newUrl, ...urls.filter((record) => record.id !== newUrl.id)];
    }

    function handleNavigationChanged(navigationData: { displayName: string; id: string }) {
      if (navigationData.displayName === "") {
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
    }

    project.addListener("navigationChanged", handleNavigationChanged);
    return () => {
      project.removeListener("navigationChanged", handleNavigationChanged);
    };
  }, [recentUrlList, urlHistory]);

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
      <ReloadButton disabled={disabled ?? false} />
      <IconButton
        onClick={() => {
          project.goHome("/{}");
        }}
        tooltip={{
          label: "Go to main screen",
          side: "bottom",
        }}
        disabled={disabled || urlList.length < 2}>
        <span className="codicon codicon-home" />
      </IconButton>
      <UrlSelect
        onValueChange={(value: string) => {
          project.openNavigation(value);
        }}
        recentItems={recentUrlList}
        items={sortedUrlList}
        value={urlList[0]?.id}
        disabled={disabled || urlList.length < 2}
      />
    </>
  );
}

export default UrlBar;
