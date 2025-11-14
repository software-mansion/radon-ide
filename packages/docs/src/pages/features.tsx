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
    <Layout
      title="Explore features of Radon. A VSCode & Cursor Extension for React Native & Expo"
      description="Explore all the available features offered by Radon and turn your editor into a React Native and Expo IDE.">
      <div className={styles.preventfulContainer}>
        <div className={clsx("border-layout")}>
          <div className={styles.titleContainer}>
            <h1 className={styles.headingLabel}>Features</h1>
            <h3 className={styles.subheadingLabel}>
              Explore features offered by Radon and turn your editor into an IDE for React Native
              and Expo
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
