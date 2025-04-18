import React from "react";
import Layout from "@theme/Layout";

import styles from "./changelog.module.css";
import ChangelogScreen from "../components/Changelog";
import LearnMoreFooter from "../components/LearnMore/LearnMoreFooter";

export default function Changelog(): JSX.Element {
  return (
    <Layout description="A better developer experience for React Native developers.">
      <div className={styles.container}>
        <h1>Changelog</h1>
        <ChangelogScreen />
        <LearnMoreFooter />
      </div>
    </Layout>
  );
}
