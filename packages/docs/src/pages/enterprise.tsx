import React, { useRef } from "react";
import clsx from "clsx";
import { track } from "@vercel/analytics";
import Layout from "@theme/Layout";
import styles from "./enterprise.module.css";
import FeaturesLanding from "../components/Features/FeaturesLanding";
import SWM from "../components/Sections/SWM";
import FAQ from "../components/Sections/FAQ";
import Testimonials from "../components/Sections/Testimonials";
import EnterpriseGridGraphic from "../components/EnterpriseGridGraphic";
import BenefitsEnterprise from "../components/Sections/BenefitsEnterprise";
import EnterpriseForm from "../components/EnterpriseForm";
import EnterprisePricingPlans from "../components/EnterprisePricingPlans";
import { useScrollToForm } from "../hooks/useScrollToForm";

export default function Enterprise(): JSX.Element {
  const pricingRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const { scrollToForm } = useScrollToForm();
  const handleSubmitTrack = () => {
    track("Enterprise form submit");
  };

  return (
    <Layout>
      <div className={styles.preventfulContainer}>
        <div className={clsx("border-layout")}>
          <div className={styles.headerWrapper}>
            <div className={styles.headerText}>
              <div className={styles.titleContainer}>
                <h1 className={styles.headingLabel}>
                  Radon <span> IDE </span> Enterprise
                </h1>
                <h3 className={styles.subheadingLabel}>
                  Helping teams deliver high-quality React Native apps faster
                </h3>
              </div>
              <div className={styles.buttonContainer}>
                <button
                  className={clsx(styles.button, styles.btnGreen)}
                  onClick={() => scrollToForm(formRef)}>
                  Schedule a demo
                </button>
                <button
                  className={clsx(styles.button, styles.btnBorder)}
                  onClick={() =>
                    pricingRef.current?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }>
                  See avaliable plans
                </button>
              </div>
            </div>
            <div className={styles.heroGraphic}>
              <EnterpriseGridGraphic />
            </div>
          </div>
          <BenefitsEnterprise />
          <FeaturesLanding />
          <EnterprisePricingPlans
            ref={pricingRef}
            onFormScrollButtonClick={() => scrollToForm(formRef)}
          />
          <Testimonials />
          <SWM>
            We are core React Native contributors & creators of key React Native libraries like
            Reanimated, Gesture Handler, or Screens.
            <br />
            <br />
            For over 12 years, we’ve been blending the best of both client and community worlds,
            building a bridge between those who use software and those who build it. With us, your
            projects and data are in safe hands.
          </SWM>
          <EnterpriseForm ref={formRef} trackSubmit={handleSubmitTrack} />
          <FAQ />
        </div>
      </div>
    </Layout>
  );
}
