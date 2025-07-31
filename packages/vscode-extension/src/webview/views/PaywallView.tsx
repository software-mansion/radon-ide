import { useState } from "react";
import "./PaywallView.css";
import Button from "../components/shared/Button";

type SubscriptionPlan = "monthly" | "yearly";

function PaywallView() {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("yearly");

  const handleContinue = () => {
    console.log(`Continue with ${selectedPlan} subscription`);
    // TODO: Implement subscription logic
  };

  return (
    <div className="paywall-view">
      <div className="paywall-container">
        <h1 className="paywall-title">Unlock Radon IDE Pro</h1>

        <div className="subscription-options">
          <div
            className={`subscription-option ${selectedPlan === "monthly" ? "selected" : ""}`}
            onClick={() => setSelectedPlan("monthly")}>
            <div className="plan-header">
              <span className="plan-name">Monthly</span>
              <span className="plan-price">$99.99/month</span>
            </div>
            <div className="plan-description">Billed monthly</div>
          </div>

          <div
            className={`subscription-option ${selectedPlan === "yearly" ? "selected" : ""}`}
            onClick={() => setSelectedPlan("yearly")}>
            <div className="plan-header">
              <span className="plan-name">Yearly</span>
              <span className="plan-price">$999.99/year</span>
            </div>
            <div className="plan-description">Save 17% • Billed annually</div>
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
