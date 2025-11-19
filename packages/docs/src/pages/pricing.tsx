import React from "react";
import Layout from "@theme/Layout";

import styles from "./pricing.module.css";
import PricingScreen from "../components/Pricing";

export default function Pricing(): JSX.Element {
  return (
    <Layout
      title="See available pricings & plans. Radon – a VSCode & Cursor Extension for React Native & Expo"
      description="Check available plans and pricings and choose an option tailored to your needs.">
      <div className={styles.preventfulContainer}>
        <div className={styles.container}>
          <PricingScreen />
        </div>
      </div>
    </Layout>
  );
}
