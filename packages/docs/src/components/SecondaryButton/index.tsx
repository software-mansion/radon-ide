import React from "react";
import styles from "./styles.module.css";
import PlayIcon from "../PlayIcon";

interface Props {
  title: string;
  onClick?: () => void;
}

export default function SecondaryButton({ title, onClick }: Props) {
  return (
    <button className={styles.secondaryButton} onClick={onClick}>
      <PlayIcon />
      {title}
    </button>
  );
}
