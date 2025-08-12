import React from "react";
import styles from "./styles.module.css";
import VSCodeIcon from "../../VSCodeIcon";
import CursorIcon from "../../CursorIcon";
interface HomeButtonProps {
  title: string;
  href: string;
  target?: "_blank" | "_parent" | "_self" | "_top";
  icon?: "vscode" | "cursor";
  onClick?: () => void;
}

export default function HomeButton({ title, href, target, icon, onClick }: HomeButtonProps) {
  return (
    <a href={href} target={target} className={styles.container} onClick={onClick}>
      <div className={styles.iconContainer}>
        {icon == "vscode" ? <VSCodeIcon /> : <CursorIcon />}
      </div>
      <div className={styles.titleContainer}>
        <p>{title}</p>
      </div>
    </a>
  );
}
