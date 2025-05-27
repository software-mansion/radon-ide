import React from "react";
import Layout from "@theme/Layout";

import styles from "./pricing.module.css";
import PricingScreen from "../components/Pricing";
import LearnMoreFooter from "../components/LearnMore/LearnMoreFooter";

export default function Pricing(): JSX.Element {
  return (
    <Layout
      title="Pricing & Plans – Radon IDE: VSCode Extension for React Native"
      description="Radon IDE is the best IDE for React Native. It comes with built-in tools for debugging, network inspection, and more. Try it for free or upgrade for more.">
      <div className={styles.preventfulContainer}>
        <div className={styles.container}>
          <PricingScreen />
          <LearnMoreFooter />
        </div>
      </div>
    </Layout>
  );
}
