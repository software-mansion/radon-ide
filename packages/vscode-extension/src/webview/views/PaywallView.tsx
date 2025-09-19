import { useEffect, useState } from "react";
import "./PaywallView.css";
import { PricePreviewResponse } from "@paddle/paddle-js";
import classNames from "classnames";
import Button from "../components/shared/Button";
import SubscriptionOption from "../components/shared/SubscriptionOption";
import RadonBackgroundImage from "../components/RadonBackgroundImage";
import usePaddle from "../hooks/usePaddle";

type SubscriptionPlan = "monthly" | "yearly";

// FIXME: Add production Paddle price IDs when ready
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
      <RadonBackgroundImage className="paywall-background-image" />
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
            <div>
              <p className="subscription-options-caption">Start with 2 week trial then:</p>

              <div className="subscription-options">
                <SubscriptionOption
                  planType="yearly"
                  planName="Yearly Plan"
                  planPrice={radonProYearlyPrice?.formattedTotals.total || ""}
                  planDescription="Billed annually"
                  showSaving={true}
                  savingText="Save 16%"
                  isSelected={selectedPlan === "yearly"}
                  onClick={() => setSelectedPlan("yearly")}
                />

                <SubscriptionOption
                  planType="monthly"
                  planName="Monthly Plan"
                  planPrice={radonProMonthlyPrice?.formattedTotals.total || ""}
                  planDescription="Billed monthly"
                  isSelected={selectedPlan === "monthly"}
                  onClick={() => setSelectedPlan("monthly")}
                />
              </div>
            </div>
          )}

          <p
            className={classNames(
              "recurring-billing-label",
              isPriceReady ? "with-prices" : "no-prices"
            )}>
            Recurring billing. Cancel anytime.
          </p>

          <div
            className={classNames(
              "continue-button-container",
              isPriceReady ? "with-prices" : "no-prices"
            )}>
            <Button
              className="continue-button"
              onClick={handleContinue}
              disabled={isLoadingPrices || !prices}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaywallView;
