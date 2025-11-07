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
  const { isMonthly, setIsMonthly, openRadonProCheckout, openRadonTeamCheckout } =
    usePricingLogic();
  const { scrollToForm } = useScrollToForm();
  const { onOpen } = useModal();
  const formRef = useRef<HTMLDivElement | null>(null);
  const handleSubmitTrack = () => {
    track("Pricing form submit");
  };

  const handlePricingTableInstall = () => {
    track("Pricing table install button");
    onOpen("Pricing table modal");
  };
  const handlePricingCardInstall = () => {
    track("Pricing card install button");
    onOpen("Pricing card modal");
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
          handleFree={handlePricingCardInstall}
          handlePro={openRadonProCheckout}
          handleTeam={openRadonTeamCheckout}
          handleEnterprise={() => scrollToForm(formRef)}
          isMonthly={isMonthly}
          setIsMonthly={setIsMonthly}
        />
      </div>
      <ComparePricingPlans
        handleFree={handlePricingTableInstall}
        handlePro={openRadonProCheckout}
        handleTeam={openRadonTeamCheckout}
        handleEnterprise={() => scrollToForm(formRef)}
      />
      <FAQ />
      <EnterpriseForm ref={formRef} trackSubmit={handleSubmitTrack} />
    </div>
  );
};

export default Pricing;
