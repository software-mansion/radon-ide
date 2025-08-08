import React from "react";
import { ColorModeToggle } from "@swmansion/t-rex-ui";
import { useColorMode } from "@docusaurus/theme-common";

export default function ThemeSwitcher({
  isThemeSwitcherShown,
}: {
  isThemeSwitcherShown?: boolean;
}) {
  const { colorMode, setColorMode } = useColorMode();
  return (
    <>
      {isThemeSwitcherShown ? (
        <ColorModeToggle
          onChange={() => {
            setColorMode(colorMode === "dark" ? "light" : "dark");
          }}
        />
      ) : null}
    </>
  );
}
