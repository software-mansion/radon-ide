import React from "react";
import Layout from "@theme/Layout";
import Hero from "@site/src/components/Hero/StartScreen";
import Disclaimer from "@site/src/components/Disclaimer";
import LearnMoreHero from "@site/src/components/LearnMore/LearnMoreHero";
import LearnMoreFooter from "@site/src/components/LearnMore/LearnMoreFooter";
import Installation from "@site/src/components/Sections/Installation";
import LandingBackground from "@site/src/components/Hero/LandingBackground";

import styles from "./index.module.css";
import Testimonials from "../components/Sections/Testimonials";
import clsx from "clsx";
import AI from "../components/Sections/AI";
import FeatureSliderLanding from "../components/Features/FeatureSliderLanding";
import LandingBanner from "../components/Features/LandingBanner";
import FeaturesLanding from "../components/Features/FeaturesLanding";

import usePaddle from "@site/src/hooks/usePaddle";
import usePosthog from "@site/src/hooks/usePosthog";

export default function Home(): JSX.Element {
  // We need to initialize on the landing coz Paddle redirects here when the user wants to change the card info, there's no way to change it
  usePaddle();
  // Sets up PostHog for A/B testing (and analytics) on the landing page
  usePosthog();

  return (
    <Layout description="Radon IDE is a VSCode extension that turns your editor into an advanced React Native IDE with a robust debugger, network inspector, and more.">
      <LandingBackground />
      <div className={styles.preventfulContainer}>
        <div className={clsx(styles.container, "border-layout")}>
          <Hero />
          {/* <Disclaimer /> */}
          {/* <LearnMoreHero /> */}
          {/* <Installation /> */}
          <LandingBanner />
          <FeatureSliderLanding />
          <FeaturesLanding />
          <AI />
          <Testimonials />
          <LearnMoreFooter />
        </div>
      </div>
    </Layout>
  );
}
