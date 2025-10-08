import Layout from "@theme/Layout";
import React from "react";
import styles from "./features.module.css";
import clsx from "clsx";
import FeatureSliderLanding from "../components/Features/FeatureSliderLanding";
import AI from "../components/Sections/AI";
import LearnMoreFooter from "../components/LearnMore/LearnMoreFooter";
import SWM from "../components/Sections/SWM";
import FeaturesGrid from "../components/Features/FeaturesGrid";

export default function Features(): JSX.Element {
  return (
    <Layout>
      <div className={styles.preventfulContainer}>
        <div className={clsx("border-layout")}>
          <div className={styles.titleContainer}>
            <h1 className={styles.headingLabel}>Features</h1>
            <h3 className={styles.subheadingLabel}>
              Radon IDE turns your editor into a fully featured IDE for React Native and Expo
            </h3>
          </div>
          <FeatureSliderLanding />
          <FeaturesGrid />
          <AI />
          <SWM>
            We are core React Native contributors & creators and maintainers of key React Native
            libraries like Reanimated, Gesture Handler, or Screens.
          </SWM>
          <LearnMoreFooter />
        </div>
      </div>
    </Layout>
  );
}
