import { use$ } from "@legendapp/state/react";
import Button from "../components/shared/Button";
import RadonBackgroundImage from "../components/RadonBackgroundImage";
import { useProject } from "../providers/ProjectProvider";
import { useStore } from "../providers/storeProvider";
import { ActivateLicenseView } from "./ActivateLicenseView";
import { useModal } from "../providers/ModalProvider";
import { Feature, FeatureNamesMap, LicenseStatus } from "../../common/License";

import "./PaywallView.css";

const proBenefits = [
  "Replays and Screen Recordings",
  "Device Screenshots",
  "Location settings",
  "Localization settings",
  "Storybook integration",
  "Radon AI assistant",
  "Remote Android Devices Integration",
  "Early access to new features",
  "All the Free features",
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

function FreeLicenseDescription() {
  return (
    <>
      <BenefitsSection title="Pro Features" items={proBenefits} variant="pro" />
    </>
  );
}

function GetLicenseButton({ label = "Get Your License" }) {
  const { project } = useProject();
  return (
    <Button
      className="get-license-button"
      onClick={() => {
        project.openExternalUrl("https://ide.swmansion.com/pricing");
      }}>
      {label}
    </Button>
  );
}

function InactiveLicenseDescription() {
  return (
    <>
      <BenefitsSection title="Pro Features" items={proBenefits} variant="pro" />
      <BenefitsSection title="Free Features" items={freeBenefits} variant="free" />
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
  const isLicenseInactive = licenseState === LicenseStatus.Inactive;

  return (
    <div className="paywall-view">
      <RadonBackgroundImage className="paywall-background-image" />
      <div className="paywall-container">
        <div>
          <h1 className="paywall-title">
            {title ?? (isLicenseInactive ? "Get Radon IDE License" : "Unlock Radon IDE Pro")}
          </h1>
          {feature && (
            <p className="paywall-feature-description">
              <b>{FeatureNamesMap[feature]}</b> feature is available with <b>Radon IDE Pro</b>
            </p>
          )}
          {isLicenseInactive ? <InactiveLicenseDescription /> : <FreeLicenseDescription />}
        </div>

        <div>
          <GetLicenseButton
            label={isLicenseInactive ? "Get Your License" : "Start Free 14-Day Pro Trial"}
          />
          <ActivateLicenseButton />
        </div>
      </div>
    </div>
  );
}

export default PaywallView;
