import { useEffect, useState } from "react";
import "./PaywallView.css";
import { PricePreviewResponse } from "@paddle/paddle-js";
import Button from "../components/shared/Button";
import RadonBackgroundImage from "../components/RadonBackgroundImage";
import usePaddle from "../hooks/usePaddle";

type SubscriptionPlan = "monthly" | "yearly";

// FIXME: Pass with production Paddle product IDs when ready
const RadonIDEProMonthlyPriceID = window.RNIDE_isDev ? "pri_01k1g12g3y3tqvpzw8tcyrsd1y" : "";
const RadonIDEProYearlyPriceID = window.RNIDE_isDev ? "pri_01k1g8d3h0mhbtr5hfd9e4n8yg" : "";

function PaywallView() {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("yearly");
  const paddle = usePaddle();
  const [prices, setPrices] = useState<PricePreviewResponse | null>(null);

  // TODO: add a sneaky way to hide loading state for prices
  async function getPrices() {
    const response = await paddle?.PricePreview({
      items: [
        { quantity: 1, priceId: RadonIDEProMonthlyPriceID },
        { quantity: 1, priceId: RadonIDEProYearlyPriceID },
      ],
      address: {
        countryCode: "US",
      },
    });

    if (!response) {
      console.error("Failed to fetch prices from Paddle");
      return;
    }
    setPrices(response || null);
  }

  useEffect(() => {
    if (paddle) {
      getPrices();
    }
  }, [paddle]);

  const radonProMonthlyPrice = prices?.data.details.lineItems.find(
    (item) => item.price.id === RadonIDEProMonthlyPriceID
  );
  const radonProYearlyPrice = prices?.data.details.lineItems.find(
    (item) => item.price.id === RadonIDEProYearlyPriceID
  );

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
              <span className="plan-price">
                {radonProYearlyPrice?.formattedTotals.total} / year
              </span>
            </div>
            <div className="plan-description">Save 17% • Billed annually</div>
          </div>

          <div
            className={`subscription-option ${selectedPlan === "monthly" ? "selected" : ""}`}
            onClick={() => setSelectedPlan("monthly")}>
            <div className="plan-header">
              <span className="plan-name">Monthly Plan</span>
              <span className="plan-price">
                {radonProMonthlyPrice?.formattedTotals.total} / month
              </span>
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
