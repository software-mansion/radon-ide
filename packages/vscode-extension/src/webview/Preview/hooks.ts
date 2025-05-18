import { useRef, useCallback } from "react";
import { keyboardEventToHID } from "../utilities/keyMapping";
import { useProject } from "../providers/ProjectProvider";
import { useDevices } from "../providers/DevicesProvider";

const CAPS_LOCK_HID_CODE = 57;

export function useKeyPresses() {
  const pressedKeys = useRef(new Set<number>());
  const lastKnownCapsLockState = useRef(false);
  const { projectState } = useProject();
  const selectedDeviceId = projectState.selectedDevice;
  const { deviceSessionsManager } = useDevices();

  if (!selectedDeviceId) return;

  const dispatchKeyPress = useCallback((e: KeyboardEvent) => {
    // CapsLock is a special case, since it fires only a keydown event when it's turned on, and only a keyup event when it's turned off.
    // However, the devices expect a full keydown-keyup sequence to properly toggle CapsLock state, and go out of sync otherwise. Moreover,
    // CapsLock can go out of sync if it's toggled outside of the context of the webview. To prevent this, we have to send full keydown-keyup
    // sequence whenever CapsLock is pressed or when we detect that it has gone out of sync when handling other keys.
    const isCapsLockActive = e.getModifierState("CapsLock");

    if (isCapsLockActive !== lastKnownCapsLockState.current) {
      lastKnownCapsLockState.current = isCapsLockActive;
      deviceSessionsManager.dispatchKeyPress(selectedDeviceId, CAPS_LOCK_HID_CODE, "Down");
      deviceSessionsManager.dispatchKeyPress(selectedDeviceId, CAPS_LOCK_HID_CODE, "Up");
    }

    const hidCode = keyboardEventToHID(e);

    if (hidCode) {
      if (hidCode === CAPS_LOCK_HID_CODE) {
        return;
      }

      const isKeydown = e.type === "keydown";

      if (isKeydown) {
        pressedKeys.current.add(hidCode);
      } else {
        pressedKeys.current.delete(hidCode);
      }

      deviceSessionsManager.dispatchKeyPress(selectedDeviceId, hidCode, isKeydown ? "Down" : "Up");
    } else {
      console.warn(`Unrecognized keyboard input: ${e.code}`);
    }
  }, []);

  const clearPressedKeys = useCallback(() => {
    for (const keyCode of pressedKeys.current) {
      deviceSessionsManager.dispatchKeyPress(selectedDeviceId, keyCode, "Up");
    }
    pressedKeys.current.clear();
  }, []);

  return {
    dispatchKeyPress,
    clearPressedKeys,
  };
}
