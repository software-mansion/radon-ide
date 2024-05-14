import React from "react";
import usePageType from "@site/src/hooks/usePageType";
import styles from "./styles.module.css";

const FooterBackground = () => {
  const { isLanding } = usePageType();

  return <>{isLanding && <div className={styles.footerBackground} />}</>;
};

export default FooterBackground;
