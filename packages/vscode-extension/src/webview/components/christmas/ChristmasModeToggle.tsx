import * as Switch from "@radix-ui/react-switch";
import { use$ } from "@legendapp/state/react";
import { useStore } from "../../providers/storeProvider";
// import "../shared/SwitchGroup.css";

function isChristmasSeason(): boolean {
  const now = new Date();
  const month = now.getMonth(); // 0-based: 0 = January, 11 = December
  const day = now.getDate();

  // December 20th to December 31st
  if (month === 11 && day >= 20) {
    return true;
  }

  // January 1st to January 20th
  if (month === 0 && day <= 20) {
    return true;
  }

  return false;
}

export function ChristmasModeToggle() {
  const store$ = useStore();
  const christmasMode = use$(store$.workspaceConfiguration.userInterface.christmasMode);

  if (!isChristmasSeason()) {
    return null;
  }

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
