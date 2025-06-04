import { useProject } from "../providers/ProjectProvider";
import UrlSelect from "./UrlSelect";
import { IconButtonWithOptions } from "./IconButtonWithOptions";
import IconButton from "./shared/IconButton";
import { useDependencies } from "../providers/DependenciesProvider";
import { useDevices } from "../providers/DevicesProvider";

function ReloadButton({ disabled }: { disabled: boolean }) {
  const { deviceSessionsManager } = useDevices();
  return (
    <IconButtonWithOptions
      onClick={() => deviceSessionsManager.reloadCurrentSession("autoReload")}
      tooltip={{
        label: "Reload the app",
        side: "bottom",
      }}
      disabled={disabled}
      options={{
        "Reload JS": () => deviceSessionsManager.reloadCurrentSession("reloadJs"),
        "Restart app process": () => deviceSessionsManager.reloadCurrentSession("restartProcess"),
        "Reinstall app": () => deviceSessionsManager.reloadCurrentSession("reinstall"),
        "Clear Metro cache": () => deviceSessionsManager.reloadCurrentSession("clearMetro"),
        "Reboot IDE": () => deviceSessionsManager.reloadCurrentSession("reboot"),
        "Clean rebuild": () => deviceSessionsManager.reloadCurrentSession("rebuild"),
      }}>
      <span className="codicon codicon-refresh" />
    </IconButtonWithOptions>
  );
}

function UrlBar({ disabled }: { disabled?: boolean }) {
  const { project, activeDeviceSession } = useProject();
  const { dependencies } = useDependencies();

  const navigationHistory = activeDeviceSession?.navigationHistory ?? [];
  const routeList = activeDeviceSession?.navigationRouteList ?? [];

  const disabledAlsoWhenStarting = disabled || activeDeviceSession?.status === "starting";
  const isExpoRouterProject = !dependencies.expoRouter?.isOptional;

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
