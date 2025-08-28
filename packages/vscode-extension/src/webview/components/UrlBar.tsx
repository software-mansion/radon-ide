import { use$ } from "@legendapp/state/react";
import { useProject } from "../providers/ProjectProvider";
import UrlSelect from "./UrlSelect";
import { IconButtonWithOptions } from "./IconButtonWithOptions";
import IconButton from "./shared/IconButton";
import { useStore } from "../providers/storeProvider";

function ReloadButton({ disabled }: { disabled: boolean }) {
  const { project } = useProject();
  return (
    <IconButtonWithOptions
      onClick={() => project.reloadCurrentSession("autoReload")}
      tooltip={{
        label: "Reload the app",
        side: "bottom",
      }}
      data-test="top-bar-reload-button"
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
  const { project, selectedDeviceSession } = useProject();
  const store$ = useStore();
  const expoRouterStatus = use$(
    store$.projectState.applicationContext.applicationDependencies.expoRouter
  );

  const navigationHistory = selectedDeviceSession?.navigationHistory ?? [];
  const routeList = selectedDeviceSession?.navigationRouteList ?? [];

  const disabledAlsoWhenStarting = disabled || selectedDeviceSession?.status === "starting";
  const isExpoRouterProject = !expoRouterStatus?.isOptional;

  return (
    <>
      <IconButton
        tooltip={{
          label: "Go back",
          side: "bottom",
        }}
        disabled={disabledAlsoWhenStarting || !isExpoRouterProject || navigationHistory.length < 2}
        onClick={() => project.navigateBack()}>
        <span className="codicon codicon-arrow-left" />
      </IconButton>
      <ReloadButton disabled={disabled ?? false} />
      <UrlSelect
        onValueChange={(value: string) => {
          project.openNavigation(value);
        }}
        navigationHistory={navigationHistory}
        routeList={routeList}
        disabled={disabledAlsoWhenStarting}
        dropdownOnly={!isExpoRouterProject}
      />
    </>
  );
}

export default UrlBar;
