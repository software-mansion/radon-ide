import React, { forwardRef } from "react";
import styles from "./styles.module.css";
import PricingPlansList from "../Pricing/PricingPlansList";
import { usePricingLogic } from "@site/src/hooks/usePricingLogic";
import { useModal } from "../ModalProvider";

interface EnterprisePricingPlansProps {
  onFormScrollButtonClick: () => void;
}

const EnterprisePricingPlans = forwardRef<HTMLDivElement, EnterprisePricingPlansProps>(
  (props, ref) => {
    const { isMonthly, setIsMonthly, openRadonProCheckout, openRadonTeamCheckout } =
      usePricingLogic();
    const { onOpen } = useModal();

    return (
      <div ref={ref} className={styles.container}>
        <p className={styles.heading}>Enterprise plans tailored to your business</p>
        <p className={styles.subheading}>Choose the subscription plan tailored to your needs</p>
        <PricingPlansList
          handleFree={onOpen}
          handlePro={openRadonProCheckout}
          handleTeam={openRadonTeamCheckout}
          handleEnterprise={props.onFormScrollButtonClick}
          isMonthly={isMonthly}
          setIsMonthly={setIsMonthly}
        />

        <div className={styles.pricingLink}>
          <p>Need to see all plan options? </p>
          <a href="/pricing">View complete pricing comparison</a>
        </div>
      </div>
    );
  }
);

export default EnterprisePricingPlans;
