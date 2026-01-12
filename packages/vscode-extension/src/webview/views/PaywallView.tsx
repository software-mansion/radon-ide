import { useEffect, useState } from "react";
import { use$ } from "@legendapp/state/react";
import { PricePreviewResponse } from "@paddle/paddle-js";
import classNames from "classnames";
import Button from "../components/shared/Button";
import SubscriptionOption from "../components/shared/SubscriptionOption";
import RadonBackgroundImage from "../components/RadonBackgroundImage";
import usePaddle from "../hooks/usePaddle";
import { useProject } from "../providers/ProjectProvider";
import { useStore } from "../providers/storeProvider";
import { ActivateLicenseView } from "./ActivateLicenseView";
import { useModal } from "../providers/ModalProvider";
import {
  Feature,
  FeatureAvailabilityStatus,
  FeatureNamesMap,
  LicenseStatus,
} from "../../common/License";

import "./PaywallView.css";

type SubscriptionPlan = "monthly" | "yearly";

// FIXME: Add production Paddle price IDs when ready
const RadonIDEProMonthlyPriceID = window.RNIDE_isDev
  ? "pri_01k1g12g3y3tqvpzw8tcyrsd1y"
  : "pri_01k8aqbvbzyz1stf8wbaf9z04y";
const RadonIDEProYearlyPriceID = window.RNIDE_isDev
  ? "pri_01k1g8d3h0mhbtr5hfd9e4n8yg"
  : "pri_01k8aqd6hs0fsj84vdk9y512tm";

const proBenefits = [
  "All the Free features",
  "Replays and Screen Recordings",
  "Device Screenshots",
  "Location settings",
  "Localization settings",
  "Storybook integration",
  "Radon AI assistant",
  "Remote Android Devices Integration",
  "Early access to new features",
];

const freeBenefits = [
  "Application Preview",
  "Expo Router Integration",
  "Element Inspector",
  "Integrated Debugger",
  "Network Inspection",
  "Redux DevTools",
  "React Query DevTools",
];

type PaywallViewProps = {
  title?: string;
  feature?: Feature;
};

function BenefitsList({ items }: { items: string[] }) {
  return (
    <ul className="paywall-benefits">
      {items.map((benefit, index) => (
        <li key={index} className="paywall-benefit">
          <span className="codicon codicon-check" />
          {benefit}
        </li>
      ))}
    </ul>
  );
}

function BenefitsSection({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "free" | "pro";
}) {
  return (
    <section className={`benefits-section ${variant}`}>
      <h3 className="benefits-title">
        <span>{title}</span>
        <span className={`benefits-badge ${variant}`}>{variant === "pro" ? "Pro" : "Free"}</span>
      </h3>
      <BenefitsList items={items} />
    </section>
  );
}

function SelectProPlan() {
  const { project } = useProject();

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

  const isPriceReady = !!prices && !isLoadingPrices && !pricesError;

  const handleContinue = () => {
    project.openExternalUrl("https://ide.swmansion.com/pricing");
  };

  return (
    <>
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

      <p
        className={classNames(
          "recurring-billing-label",
          isPriceReady ? "with-prices" : "no-prices"
        )}>
        Recurring billing. Cancel anytime.
      </p>

      {pricesError && (
        <p className="pricing-error" role="alert">
          {pricesError}
        </p>
      )}

      <div
        className={classNames(
          "continue-button-container",
          isPriceReady ? "with-prices" : "no-prices"
        )}>
        <Button
          className="continue-button"
          onClick={handleContinue}
          disabled={isLoadingPrices || !prices}>
          Try Free
        </Button>
      </div>
    </>
  );
}

function FreeLicenseDescription() {
  return (
    <>
      <BenefitsSection title="Pro Features" items={proBenefits} variant="pro" />
      <SelectProPlan />
    </>
  );
}

function GetLicenseButton() {
  const { project } = useProject();
  return (
    <Button
      className="get-license-button"
      onClick={() => {
        project.openExternalUrl("https://ide.swmansion.com/pricing");
      }}>
      {"Get Your Free License"}
    </Button>
  );
}

function InactiveLicenseDescription() {
  return (
    <>
      <BenefitsSection title="Free Features" items={freeBenefits} variant="free" />
      <BenefitsSection title="Pro Features" items={proBenefits} variant="pro" />
      <GetLicenseButton />
    </>
  );
}

function ActivateLicenseButton() {
  const { openModal } = useModal();
  const { project } = useProject();
  return (
    <Button
      className="activate-button"
      onClick={() => {
        project.sendTelemetry("activateLicenseButtonClicked");
        openModal(<ActivateLicenseView />, { title: "Activate License" });
      }}>
      {"Activate License"}
    </Button>
  );
}

function PaywallView({ title, feature }: PaywallViewProps) {
  const store$ = useStore();

  const licenseState = use$(store$.license.status);
  const featuresAvailability = use$(store$.license.featuresAvailability);

  const isLicenseInactive = licenseState === LicenseStatus.Inactive;
  const isFeaturePaywalled =
    feature && featuresAvailability[feature] === FeatureAvailabilityStatus.PAYWALLED;

  const showGetProMessage = isFeaturePaywalled || !isLicenseInactive;

  return (
    <div className="paywall-view">
      <RadonBackgroundImage className="paywall-background-image" />
      <div className="paywall-container">
        <h1 className="paywall-title">
          {title ?? (showGetProMessage ? "Unlock Radon IDE Pro" : "Get Radon IDE License")}
        </h1>
        {feature && (
          <p className="paywall-feature-description">
            <b>{FeatureNamesMap[feature]}</b> feature is available with <b>Radon IDE Pro</b>
          </p>
        )}

        {showGetProMessage ? <FreeLicenseDescription /> : <InactiveLicenseDescription />}

        <ActivateLicenseButton />
      </div>
    </div>
  );
}

export default PaywallView;
