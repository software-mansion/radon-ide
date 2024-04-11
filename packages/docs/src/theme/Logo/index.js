import React from "react";
import LogoStyling from "@site/src/theme/Logo/LogoStyling";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./styles.module.css";

export default function LogoWrapper(props) {
  const heroImages = {
    logo: useBaseUrl("/img/logo.svg"),
  };

  return (
    <div className="haha">
      <LogoStyling
        heroImages={heroImages}
        className={styles.navbar__logo}
        titleClassName={styles.navbar__title}
      />
    </div>
  );
}
