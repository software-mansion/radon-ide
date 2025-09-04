import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";
import CheckIcon from "../../CheckIcon";
import PlanLabelCard from "./PlanLabelCard";

export interface FeatureItem {
  label: string;
  free: string[] | boolean;
  pro: string[] | boolean;
  enterprise: string[] | boolean;
}

const pricingPlanFeatures = [
  { label: "Element inspector", free: true, pro: true, enterprise: true },
  { label: "Debugging and logging", free: true, pro: true, enterprise: true },
  { label: "Isolated components preview", free: true, pro: true, enterprise: true },
  {
    label: "Dev tools",
    free: [
      "Outline render",
      "JavaScript CPU profiler",
      "Redux DevTools integration",
      "React Query devtools plugin",
      "React Profiler integration",
    ],
    pro: [
      "Outline render",
      "JavaScript CPU profiler",
      "Redux DevTools integration",
      "React Query devtools plugin",
      "React Profiler integration",
    ],
    enterprise: [
      "Outline render",
      "JavaScript CPU profiler",
      "Redux DevTools integration",
      "React Query devtools plugin",
      "React Profiler integration",
    ],
  },
  {
    label: "Device emulator",
    free: ["Phones only"],
    pro: ["Phones and tablets"],
    enterprise: ["Phones and tablets"],
  },
  {
    label: "Device settings",
    free: ["Device appearance", "Text size", "Home button and app switcher", "Audio volume"],
    pro: [
      "Device appearance",
      "Text size",
      "Home button and app switcher",
      "Audio volume",
      "Portrait/landscape orientation",
      "Location",
      "Localization",
      "Permissions",
      "Biometrics",
    ],
    enterprise: [
      "Device appearance",
      "Text size",
      "Home button and app switcher",
      "Audio volume",
      "Portrait/landscape orientation",
      "Location",
      "Localization",
      "Permissions",
      "Biometrics",
    ],
  },
  { label: "Connect mode", free: true, pro: true, enterprise: true },
  { label: "Expo Router integration", free: true, pro: true, enterprise: true },
  { label: "Network inspector", free: true, pro: true, enterprise: true },
  { label: "Screenshots", free: false, pro: true, enterprise: true },
  { label: "Screen recording", free: false, pro: true, enterprise: true },
  { label: "Replays", free: false, pro: true, enterprise: true },
  { label: "Storybook integration", free: false, pro: true, enterprise: true },
  { label: "Radon AI assistant", free: false, pro: true, enterprise: true },
  { label: "Multiple license management", free: false, pro: false, enterprise: true },
  { label: "Centralized team billing", free: false, pro: false, enterprise: true },
  { label: "Single sign-on for the Radon IDE Portal", free: false, pro: false, enterprise: true },
  { label: "Insights Dashboard with usage stats", free: false, pro: false, enterprise: true },
  { label: "Service-level Agreement (SLA)", free: false, pro: false, enterprise: true },
  { label: "Dedicated payment method and invoicing", free: false, pro: false, enterprise: true },
  { label: "Onboarding meeting", free: false, pro: false, enterprise: true },
  {
    label: "Support",
    free: ["via GitHub issues"],
    pro: ["via GitHub or email"],
    enterprise: ["via GitHub, email or a dedicated Slack channel"],
  },
];

const handleCellContent = (data: string[] | boolean) => {
  if (Array.isArray(data)) {
    return data.map((element, idx) => <p key={idx}>{element}</p>);
  } else if (data === true) {
    return <CheckIcon />;
  } else {
    return <p className={styles.notIncluded}>—</p>;
  }
};

export default function ComparePricingPlans() {
  return (
    <div>
      <div className={styles.title}>Compare plans</div>
      <div className={styles.container}>
        <div className={styles.planColumns}>
          <div className={styles.columnName}>Features</div>
          <PlanLabelCard
            plan="FREE"
            monthlyPrice={0}
            buttonLabel="Download"
            stylingFilled={false}
          />
          <PlanLabelCard
            plan="PRO"
            monthlyPrice={39}
            yearlyLowPrice={390}
            buttonLabel="Start 14-day trial"
            stylingFilled={true}
          />
          <PlanLabelCard
            plan="ENTERPRISE"
            monthlyPrice={99}
            yearlyLowPrice={990}
            buttonLabel="Get your quote"
            stylingFilled={true}
          />
        </div>
        {pricingPlanFeatures.map((feature, index) => (
          <div key={index} className={styles.table}>
            <div className={styles.featureLabelCell}>{feature.label}</div>
            <div className={styles.valueCell}>{handleCellContent(feature.free)}</div>
            <div className={styles.valueCell}>{handleCellContent(feature.pro)}</div>
            <div className={styles.valueCell}>{handleCellContent(feature.enterprise)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
