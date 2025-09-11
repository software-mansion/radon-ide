import Layout from "@theme/Layout";
import clsx from "clsx";
import React from "react";
import styles from "./enterprise.module.css";
import FeaturesLanding from "../components/Features/FeaturesLanding";
import SWM from "../components/Sections/SWM";
import FAQ from "../components/Sections/FAQ";
import Testimonials from "../components/Sections/Testimonials";
import EnterpriseGridGraphic from "../components/EnterpriseGridGraphic";
import BenefitsEnterprise from "../components/Sections/BenefitsEnterprise";

export default function Enterprise(): JSX.Element {
  return (
    <Layout>
      <div className={styles.preventfulContainer}>
        <div className={clsx("border-layout")}>
          <div className={styles.headerWrapper}>
            <div className={styles.headerText}>
              <div className={styles.titleContainer}>
                <h1 className={styles.headingLabel}>
                  Radon <span>IDE</span> Enterprise
                </h1>
                <h3 className={styles.subheadingLabel}>
                  Helping teams deliver high-quality React Native apps faster
                </h3>
              </div>
              <div className={styles.buttonContainer}>
                <a href={"/"} className={clsx(styles.button, styles.btnGreen)}>
                  Schedule a demo
                </a>
                <a href={"/"} className={clsx(styles.button, styles.btnBorder)}>
                  See avaliable plans
                </a>
              </div>
            </div>
            <EnterpriseGridGraphic />
          </div>
          <BenefitsEnterprise />
          <FeaturesLanding />
          <Testimonials />
          <SWM />
          <FAQ />
        </div>
      </div>
    </Layout>
  );
}
