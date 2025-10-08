import React, { useRef } from "react";
import styles from "./styles.module.css";
import PricingPlansList from "./PricingPlansList";
import FAQ from "../Sections/FAQ";
import clsx from "clsx";
import ComparePricingPlans from "./ComparePricingPlans";
import { usePricingLogic } from "@site/src/hooks/usePricingLogic";
import EnterpriseForm from "../EnterpriseForm";

export interface PricingProps {
  handleIndividual: () => void;
  handleBusiness: () => void;
  handleCustom: () => void;
  isMonthly?: boolean;
  setIsMonthly?: (value: boolean) => void;
}

const Pricing = () => {
  const { isMonthly, setIsMonthly, openBusinessCheckout, openIndividualCheckout, scrollToForm } =
    usePricingLogic();
  const formRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className={clsx(styles.container, "border-layout")}>
      <div className={styles.titleContainer}>
        <h1 className={styles.headingLabel}>Pricing</h1>
        <h3 className={styles.subheadlingLabel}>
          Choose the subscription plan tailored to your needs
        </h3>
      </div>
      <div className={styles.wrapper}>
        <PricingPlansList
          handleBusiness={openBusinessCheckout}
          handleIndividual={openIndividualCheckout}
          handleCustom={() => scrollToForm(formRef)}
          isMonthly={isMonthly}
          setIsMonthly={setIsMonthly}
        />
      </div>
      <ComparePricingPlans
        handleIndividual={openIndividualCheckout}
        handleBusiness={openBusinessCheckout}
        handleCustom={() => scrollToForm(formRef)}
      />
      <FAQ />
      <EnterpriseForm ref={formRef} />
    </div>
  );
};

export default Pricing;
