import { useEffect, useState } from "react";
import "./PaywallView.css";
import { PricePreviewResponse } from "@paddle/paddle-js";
import classNames from "classnames";
import Button from "../components/shared/Button";
import RadonBackgroundImage from "../components/RadonBackgroundImage";
import usePaddle from "../hooks/usePaddle";

type SubscriptionPlan = "monthly" | "yearly";

// FIXME: Pass with production Paddle product IDs when ready
const RadonIDEProMonthlyPriceID = window.RNIDE_isDev ? "pri_01k1g12g3y3tqvpzw8tcyrsd1y" : "";
const RadonIDEProYearlyPriceID = window.RNIDE_isDev ? "pri_01k1g8d3h0mhbtr5hfd9e4n8yg" : "";

const benefits = [
  "All the Free features",
  "Redux UI plugin",
  "React Query plugin",
  "CPU Profiler integration",
  "React Profiler integration",
  "React Scan integration",
  "Radon AI assistant",
  "Early access to new features",
  "Priority support",
];

function PaywallView() {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("yearly");
  const paddle = usePaddle();
  const [prices, setPrices] = useState<PricePreviewResponse | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  async function getPrices() {
    setIsLoadingPrices(true);
    setPricesError(null);

    try {
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
        throw new Error("Failed to fetch prices from Paddle - no response received");
      }

      setPrices(response);
      setIsLoadingPrices(false);
    } catch (error) {
      console.error("Failed to fetch prices from Paddle:", error);
      setPricesError(error instanceof Error ? error.message : "Failed to load pricing information");
    } finally {
      setIsLoadingPrices(false);
    }
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

  const isPriceReady = !isLoadingPrices && !pricesError && prices;
  const shouldShowPaywall = !isLoadingPrices;

  const handleContinue = () => {
    console.log(`Continue with ${selectedPlan} subscription`);
    // TODO: Implement subscription logic
  };

  return (
    <div className="paywall-view">
      <RadonBackgroundImage color="#222" className="paywall-background-image" />
      {shouldShowPaywall && (
        <div className="paywall-container">
          <h1 className="paywall-title">Unlock Radon IDE Pro</h1>

          <ul className="paywall-benefits">
            {benefits.map((benefit, index) => (
              <li key={index} className="paywall-benefit">
                <span className="codicon codicon-check" />
                {benefit}
              </li>
            ))}
          </ul>

          {isPriceReady && (
            <div className="subscription-options-container">
              <p className="subscription-options-caption">Start with 2 week trial then:</p>

              <div className="subscription-options loaded">
                <div
                  className={classNames(
                    "subscription-option",
                    selectedPlan === "yearly" && "selected"
                  )}
                  onClick={() => setSelectedPlan("yearly")}>
                  <div className="plan-header">
                    <span className="plan-name">
                      Yearly Plan <span className="plan-saving">Save 16%</span>
                    </span>
                    <span className="plan-price">
                      <span>{radonProYearlyPrice?.formattedTotals.total}</span> / year
                    </span>
                  </div>
                  <div className="plan-description">Billed annually</div>
                </div>

                <div
                  className={classNames(
                    "subscription-option",
                    selectedPlan === "monthly" && "selected"
                  )}
                  onClick={() => setSelectedPlan("monthly")}>
                  <div className="plan-header">
                    <span className="plan-name">Monthly Plan</span>
                    <span className="plan-price">
                      <span>{radonProMonthlyPrice?.formattedTotals.total}</span> / month
                    </span>
                  </div>
                  <div className="plan-description">Billed monthly</div>
                </div>
              </div>
            </div>
          )}

          <p className={`recurring-billing-label ${isPriceReady ? "with-prices" : "no-prices"}`}>
            Recurring billing. Cancel anytime.
          </p>

          <Button
            className={`continue-button ${isPriceReady ? "with-prices" : "no-prices"}`}
            onClick={handleContinue}
            disabled={isLoadingPrices || !prices}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

export default PaywallView;
