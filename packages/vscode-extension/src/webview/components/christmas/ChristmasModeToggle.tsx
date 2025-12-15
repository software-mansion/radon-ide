import * as Switch from "@radix-ui/react-switch";
import { use$ } from "@legendapp/state/react";
import { useStore } from "../../providers/storeProvider";
export function ChristmasModeToggle() {
  const store$ = useStore();
  const christmasMode = use$(store$.workspaceConfiguration.userInterface.christmasMode);
  return (
    <div className="dropdown-menu-item">
      <span className="codicon codicon-sparkle" />
      Christmas Mode
      <Switch.Root
        className="switch-root small-switch"
        id="christmas-mode"
        data-testid="settings-dropdown-christmas-mode-switch"
        onCheckedChange={(checked) =>
          store$.workspaceConfiguration.userInterface.christmasMode.set(checked)
        }
        defaultChecked={christmasMode}
        style={{ marginLeft: "auto" }}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </div>
  );
}
