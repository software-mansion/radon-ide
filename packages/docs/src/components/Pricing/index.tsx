import React, { useRef } from "react";
import styles from "./styles.module.css";
import { track } from "@vercel/analytics";
import PricingPlansList from "./PricingPlansList";
import FAQ from "../Sections/FAQ";
import clsx from "clsx";
import ComparePricingPlans from "./ComparePricingPlans";
import { usePricingLogic } from "@site/src/hooks/usePricingLogic";
import EnterpriseForm from "../EnterpriseForm";
import { useScrollToForm } from "@site/src/hooks/useScrollToForm";
import { useModal } from "../ModalProvider";

export interface PricingProps {
  handleFree: () => void;
  handlePro: () => void;
  handleTeam: () => void;
  handleEnterprise: () => void;
  isMonthly?: boolean;
  setIsMonthly?: (value: boolean) => void;
}

const Pricing = () => {
  const { isMonthly, setIsMonthly, openBusinessCheckout, openIndividualCheckout } =
    usePricingLogic();
  const { scrollToForm } = useScrollToForm();
  const { onOpen } = useModal();
  const formRef = useRef<HTMLDivElement | null>(null);
  const handleSubmitTrack = () => {
    track("Pricing form submit");
  };

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
          handleFree={onOpen}
          handleTeam={openBusinessCheckout}
          handlePro={openIndividualCheckout}
          handleEnterprise={() => scrollToForm(formRef)}
          isMonthly={isMonthly}
          setIsMonthly={setIsMonthly}
        />
      </div>
      <ComparePricingPlans
        handleFree={onOpen}
        handlePro={openIndividualCheckout}
        handleTeam={openBusinessCheckout}
        handleEnterprise={() => scrollToForm(formRef)}
      />
      <FAQ />
      <EnterpriseForm ref={formRef} trackSubmit={handleSubmitTrack} />
    </div>
  );
};

export default Pricing;
