import { use$ } from "@legendapp/state/react";
import { useProject } from "../providers/ProjectProvider";
import UrlSelect from "./UrlSelect";
import { IconButtonWithOptions } from "./IconButtonWithOptions";
import IconButton from "./shared/IconButton";
import { useStore } from "../providers/storeProvider";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";

function ReloadButton({ disabled }: { disabled: boolean }) {
  const { project } = useProject();
  return (
    <IconButtonWithOptions
      onClick={() => project.reloadCurrentSession("autoReload")}
      tooltip={{
        label: "Reload the app",
        side: "bottom",
      }}
      dataTest="top-bar-reload-button"
      disabled={disabled}
      options={{
        "Reload JS": () => project.reloadCurrentSession("reloadJs"),
        "Restart app process": () => project.reloadCurrentSession("restartProcess"),
        "Reinstall app": () => project.reloadCurrentSession("reinstall"),
        "Restart Metro server": () => project.reloadCurrentSession("restartMetro"),
        "Clear Metro cache": () => project.reloadCurrentSession("clearMetro"),
        "Reboot Device": () => project.reloadCurrentSession("reboot"),
        "Clean rebuild": () => project.reloadCurrentSession("rebuild"),
      }}>
      <span className="codicon codicon-refresh" />
    </IconButtonWithOptions>
  );
}

function UrlBar({ disabled }: { disabled?: boolean }) {
  const { project } = useProject();
  const store$ = useStore();
  const selectedDeviceSessionState = useSelectedDeviceSessionState();
  const selectedDeviceSessionStatus = use$(selectedDeviceSessionState.status);

  const expoRouterStatus = use$(
    store$.projectState.applicationContext.applicationDependencies.expoRouter
  );

  const navigationHistory = use$(selectedDeviceSessionState.navigationState.navigationHistory);
  const navigationRouteList = use$(selectedDeviceSessionState.navigationState.navigationRouteList);

  const disabledAlsoWhenStarting = disabled || selectedDeviceSessionStatus === "starting";
  const canGoBack = navigationHistory?.[0]?.canGoBack;
  const isExpoRouterProject = !expoRouterStatus?.isOptional;

  return (
    <>
      <IconButton
        tooltip={{
          label: "Go back",
          side: "bottom",
        }}
        disabled={disabledAlsoWhenStarting || !canGoBack}
        onClick={() => project.navigateBack()}>
        <span className="codicon codicon-arrow-left" />
      </IconButton>
      <ReloadButton disabled={disabled ?? false} />
      <UrlSelect
        onValueChange={(value: string) => {
          project.openNavigation(value);
        }}
        navigationHistory={navigationHistory ?? []}
        routeList={navigationRouteList ?? []}
        disabled={disabledAlsoWhenStarting}
        dropdownOnly={!isExpoRouterProject}
      />
    </>
  );
}

export default UrlBar;
