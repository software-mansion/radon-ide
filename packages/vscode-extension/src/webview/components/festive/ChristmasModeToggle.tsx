import * as Switch from "@radix-ui/react-switch";
import { use$ } from "@legendapp/state/react";
import { useStore } from "../../providers/storeProvider";
export function festiveModeToggle() {
  const store$ = useStore();
  const festiveMode = use$(store$.workspaceConfiguration.userInterface.festiveMode);
  return (
    <div className="dropdown-menu-item">
      <span className="codicon codicon-sparkle" />
      Festive Mode
      <Switch.Root
        className="switch-root small-switch"
        id="festive-mode"
        data-testid="settings-dropdown-festive-mode-switch"
        onCheckedChange={(checked) =>
          store$.workspaceConfiguration.userInterface.festiveMode.set(checked)
        }
        defaultChecked={festiveMode}
        style={{ marginLeft: "auto" }}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </div>
  );
}
