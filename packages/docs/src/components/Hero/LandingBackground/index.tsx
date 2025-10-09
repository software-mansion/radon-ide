import React from "react";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import styles from "./styles.module.css";

const LandingBackground = () => {
  return <div className={styles.heroBackground}>{ExecutionEnvironment.canUseViewport}</div>;
};

export default LandingBackground;
