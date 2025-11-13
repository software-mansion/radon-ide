import { PricingPlanCardProps } from "./PricingPlansList";

export const pricingIndividualData: PricingPlanCardProps[] = [
  {
    plan: "FREE",
    price: { monthly: 0, yearlyPerMonth: 0 },
    label: "For non-commercial use",
    buttonLabel: "Get free license",
    href: "https://portal.ide.swmansion.com",
    stylingFilled: false,
    featuresAll: [
      { label: "Element inspector" },
      { label: "Debugging and logging" },
      {
        label: "Dev tools",
        info: "Outline render, JavaScript CPU profiler, Redux DevTools integration, React Query devtools plugin, React Profiler integration",
      },
      { label: "Isolated components preview" },
      { label: "Basic device emulator", info: "Phones only" },
      {
        label: "Basic device settings",
        info: "Device appearance, Text size, Home button and app switcher, Audio volume",
      },
      { label: "Connect mode" },
      { label: "Expo Router integration" },
      { label: "Network inspector" },
      { label: "Support via GitHub issues" },
    ],
  },
  {
    plan: "PRO",
    price: { monthly: 25, yearlyPerMonth: 21 },
    label: "For professional developers",
    buttonLabel: "Start 14-day trial",
    stylingFilled: true,
    featuresAll: [
      { label: "Screenshots & screen recording" },
      { label: "Replays" },
      { label: "Extended device emulator", info: "Phones and tablets" },
      {
        label: "Advanced device settings",
        info: "Device appearance, Text size, Home button and app switcher, Audio volume, Portrait/landscape orientation, Location, Localization, Permissions, Biometrics",
      },
      { label: "Storybook integration" },
      { label: "Radon AI assistant" },
      { label: "Early access to new features" },
      { label: "Priority support via email" },
    ],
  },
];
