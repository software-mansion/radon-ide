import React from "react";
import Elipse from "@site/src/components/Elipse";
import Layout from "@theme/Layout";
import Hero from "@site/src/components/Hero/StartScreen";
import LearnMoreHero from "@site/src/components/LearnMore/LearnMoreHero";
import LearnMoreFooter from "@site/src/components/LearnMore/LearnMoreFooter";
import Installation from "@site/src/components/Sections/Installation";
import FooterBackground from "../components/FooterBackground";
import Overview from "@site/src/components/Sections/Overview";
import FAQ from "@site/src/components/Sections/FAQ";

import styles from "./index.module.css";

export default function Home(): JSX.Element {
  return (
    <Layout description="A better developer experience for React Native developers.">
      <div className={styles.preventfulContainer}>
        <div className={styles.container}>
          <Hero />
          {/* <LearnMoreHero /> */}
          {/* <Installation /> */}
          <Overview />
          <FAQ />
          <LearnMoreFooter />
        </div>
      </div>
      <FooterBackground />
    </Layout>
  );
}
