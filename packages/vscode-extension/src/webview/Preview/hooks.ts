import { useRef, useCallback } from "react";
import { keyboardEventToHID } from "../utilities/keyMapping";
import { useProject } from "../providers/ProjectProvider";


export function useKeyPresses() {
  const pressedKeys = useRef(new Set<number>());
  const { project } = useProject();

  const dispatchKeyPress = useCallback((e: KeyboardEvent) => {
    const isKeydown = e.type === "keydown";
    const hidCode = keyboardEventToHID(e);

    if (hidCode) {
      if (isKeydown) {
        pressedKeys.current.add(hidCode);
      } else {
        pressedKeys.current.delete(hidCode);
      }

      project.dispatchKeyPress(hidCode, isKeydown ? "Down" : "Up");
    } else {
      console.warn(`Unrecognized keyboard input: ${e.code}`);
    }
  }, []);

  const clearPressedKeys = useCallback(() => {
    for (const keyCode of pressedKeys.current) {
      project.dispatchKeyPress(keyCode, "Up");
    }
    pressedKeys.current.clear();
  }, []);

  return {
    dispatchKeyPress,
    clearPressedKeys,
  };
}
