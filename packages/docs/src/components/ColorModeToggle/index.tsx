import React, { useState } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";
import IconLightMode from "../IconLightMode";
import IconDarkMode from "../IconDarkMode";
import IconSystemMode from "../IconSystemMode";
import { useColorMode } from "@docusaurus/theme-common";

function ColorModeToggle() {
  const { colorMode, setColorMode } = useColorMode();
  const [theme, setTheme] = useState("system");

  const current = theme === "system" ? "system" : colorMode;

  const handleModeChange = (mode: any) => {
    if (mode === "system") {
      setColorMode(null);
      setTheme("system");
    } else {
      setColorMode(mode);
      setTheme(mode);
    }
  };

  return (
    <div className={styles.toggle}>
      <button
        type="button"
        className={clsx(current === "system" && styles.active)}
        onClick={() => {
          handleModeChange("system");
        }}>
        <IconSystemMode />
      </button>
      <button
        type="button"
        className={clsx(current === "light" && styles.active)}
        onClick={() => {
          handleModeChange("light");
        }}>
        <IconLightMode />
      </button>
      <button
        type="button"
        className={clsx(current === "dark" && styles.active)}
        onClick={() => {
          handleModeChange("dark");
        }}>
        <IconDarkMode />
      </button>
    </div>
  );
}

export default ColorModeToggle;
