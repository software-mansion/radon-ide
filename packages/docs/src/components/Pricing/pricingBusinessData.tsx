import { PricingPlanCardProps } from "./PricingPlansList";

export const pricingBusinessData: PricingPlanCardProps[] = [
  {
    plan: "TEAM",
    price: { monthly: 75, yearly: 750 },
    yearlyFullPrice: 900,
    label: "For small and medium teams",
    buttonLabel: "Buy your licenses",
    stylingFilled: true,
    featuresAll: [
      { label: "Element inspector" },
      { label: "Debugging and logging" },
      {
        label: "Dev tools",
        info: "Outline render, JavaScript CPU profiler, Redux DevTools integration, React Query devtools plugin, React Profiler integration",
      },
      { label: "Isolated components preview" },
      { label: "Screenshots & screen recording" },
      { label: "Replays" },
      { label: "Extended device emulator", info: "Phones and tablets" },
      {
        label: "Advanced device settings",
        info: "Device appearance, Text size, Home button and app switcher, Audio volume, Portrait/landscape orientation, Location, Localization, Permissions, Biometrics",
      },
      { label: "Connect mode" },
      { label: "Expo Router integration" },
      { label: "Network inspector" },
      { label: "Storybook integration" },
      { label: "Radon AI assistant" },
    ],
    featuresTeamManagement: [
      { label: "Multiple license management" },
      { label: "Centralized team billing" },
      { label: "Insights Dashboard with usage stats" },
    ],
    featuresSupport: [
      { label: "Early access to new features" },
      { label: "Priority support via email" },
    ],
  },
  {
    plan: "ENTERPRISE",
    price: { monthly: "Custom pricing", yearly: "Custom pricing" },
    yearlyFullPrice: "",
    label: "For enterprise-grade teams",
    buttonLabel: "Get your quote",
    stylingFilled: true,
    featuresAll: [
      {
        label: "Usage-based pricing",
        info: "You only pay for the number of seats that your employees are actually using",
      },
      { label: "Single sign-on for the Radon IDE Portal" },
      { label: "Service-level agreement (SLA)" },
      { label: "Dedicated payment method and invoicing" },
      { label: "Onboarding meeting" },
      {
        label: "Expert React Native consulting",
        info: "",
      },
      { label: "Support via a dedicated Slack channel" },
    ],
  },
];
