import { useState } from "react";
import "./PaywallView.css";
import Button from "../components/shared/Button";
import RadonBackgroundImage from "../components/RadonBackgroundImage";

type SubscriptionPlan = "monthly" | "yearly";

function PaywallView() {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("yearly");

  const handleContinue = () => {
    console.log(`Continue with ${selectedPlan} subscription`);
    // TODO: Implement subscription logic
  };

  return (
    <div className="paywall-view">
      <RadonBackgroundImage color="#222" className="paywall-background-image" />
      <div className="paywall-container">
        <h1 className="paywall-title">Unlock Radon IDE Pro</h1>

        <div className="subscription-options">
          <div
            className={`subscription-option ${selectedPlan === "yearly" ? "selected" : ""}`}
            onClick={() => setSelectedPlan("yearly")}>
            <div className="plan-header">
              <span className="plan-name">Yearly Plan</span>
              <span className="plan-price">$390 / year</span>
            </div>
            <div className="plan-description">Save 17% • Billed annually</div>
          </div>

          <div
            className={`subscription-option ${selectedPlan === "monthly" ? "selected" : ""}`}
            onClick={() => setSelectedPlan("monthly")}>
            <div className="plan-header">
              <span className="plan-name">Monthly Plan</span>
              <span className="plan-price">$39 / month</span>
            </div>
            <div className="plan-description">Billed monthly</div>
          </div>
        </div>

        <p>Recurring billing. Cancel anytime.</p>

        <Button className="continue-button" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export default PaywallView;
