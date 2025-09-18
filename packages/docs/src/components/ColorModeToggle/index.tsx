import React, { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";
import IconLightMode from "../IconLightMode";
import IconDarkMode from "../IconDarkMode";
import IconSystemMode from "../IconSystemMode";
import { useColorMode } from "@docusaurus/theme-common";

function ColorModeToggle() {
  const { colorMode, setColorMode } = useColorMode();
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "system";
  });

  const handleModeChange = (mode: "system" | "light" | "dark") => {
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
        className={clsx(theme === "system" && styles.active)}
        onClick={() => {
          handleModeChange("system");
        }}>
        <IconSystemMode />
      </button>
      <button
        type="button"
        className={clsx(theme === "light" && styles.active)}
        onClick={() => {
          handleModeChange("light");
        }}>
        <IconLightMode />
      </button>
      <button
        type="button"
        className={clsx(theme === "dark" && styles.active)}
        onClick={() => {
          handleModeChange("dark");
        }}>
        <IconDarkMode />
      </button>
    </div>
  );
}

export default ColorModeToggle;
