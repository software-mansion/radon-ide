import React, { useEffect, useState } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";
import IconLightMode from "../IconLightMode";
import IconDarkMode from "../IconDarkMode";
import IconSystemMode from "../IconSystemMode";
import { useColorMode } from "@docusaurus/theme-common";

function ColorModeToggle() {
  const { setColorMode } = useColorMode();
  const [theme, setTheme] = useState<"system" | "light" | "dark">("dark");

  useEffect(() => {
    const userTheme = localStorage.getItem("user-theme");
    const initialTheme = (userTheme as "system" | "light" | "dark") || "dark";

    setTheme(initialTheme);

    if (!userTheme) {
      localStorage.setItem("user-theme", "dark");
    }
    const newColorMode = initialTheme === "system" ? undefined : initialTheme;
    setColorMode(newColorMode);
  }, []);

  const handleModeChange = (mode: "system" | "light" | "dark") => {
    setTheme(mode);
    localStorage.setItem("user-theme", mode);

    const newColorMode = mode === "system" ? undefined : mode;
    setColorMode(newColorMode);
  };

  return (
    <div className={styles.toggle}>
      <button
        type="button"
        className={clsx(styles.button, theme === "system" && styles.active)}
        onClick={() => {
          handleModeChange("system");
        }}>
        <IconSystemMode />
      </button>
      <button
        type="button"
        className={clsx(styles.button, theme === "light" && styles.active)}
        onClick={() => {
          handleModeChange("light");
        }}>
        <IconLightMode />
      </button>
      <button
        type="button"
        className={clsx(styles.button, theme === "dark" && styles.active)}
        onClick={() => {
          handleModeChange("dark");
        }}>
        <IconDarkMode />
      </button>
    </div>
  );
}

export default ColorModeToggle;
