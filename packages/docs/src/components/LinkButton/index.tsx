import React from "react";
import styles from "./styles.module.css";

import ArrowRight from "@site/static/img/arrow-right-hero.svg";

interface Props {
  title: string;
  href: string;
  onClick?: () => void;
}

export default function LinkButton({ title, href, onClick }: Props) {
  return (
    <div className={styles.linkButtonWrapper}>
      <a href={href} target="_blank" className={styles.linkButton} onClick={onClick}>
        {title}
        <ArrowRight className={styles.linkButtonArrow} />
      </a>
    </div>
  );
}
