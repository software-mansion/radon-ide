import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Switch from "@radix-ui/react-switch";

import { vscode } from "../utilities/vscode";
import "./SettingsDropdown.css";
import { useModal } from "../providers/ModalProvider";

import DiagnosticView from "../views/DiagnosticView";
import AndroidImagesView from "../views/AndroidImagesView";
import ManageDevicesView from "../views/ManageDevicesView";

import { MANAGE_DEVICE_OPTION_NAME } from '../utilities/consts';

interface SettingsDropdownProps {
  children: React.ReactNode;
}

function SettingsDropdown({ children }: SettingsDropdownProps) {
  const { openModal } = useModal();

  const handleBuildCachingSwitch = (enabled: boolean) => {
    vscode.postMessage({
      command: "switchBuildCaching",
      enabled,
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <div>{children}</div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown-menu-content">
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              // @ts-ignore TODO fix this
              openModal("Diagnostics", <DiagnosticView />);
            }}>
            Run diagnostics...
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={(e) => {
              e.preventDefault();
            }}>
            Enable build caching
            <div className="right-slot">
              <Switch.Root
                className="switch-root"
                defaultChecked
                onCheckedChange={handleBuildCachingSwitch}>
                <Switch.Thumb className="switch-thumb" />
              </Switch.Root>
            </div>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="dropdown-menu-separator" />
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              // @ts-ignore TODO fix this
              openModal("Manage Android SDKs", <AndroidImagesView />);
            }}>
            Manage Android SDKs...
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              openModal(MANAGE_DEVICE_OPTION_NAME, <ManageDevicesView />);
            }}>
            {MANAGE_DEVICE_OPTION_NAME}
          </DropdownMenu.Item>
          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default SettingsDropdown;
