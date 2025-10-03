export const pricingBusinessData = [
  {
    plan: "TEAM",
    price: { monthly: 75, yearly: 750 },
    yearlyFullPrice: 900,
    label: "For small and medium teams",
    buttonLabel: "Buy license",
    stylingFilled: true,
    featuresAll: [
      { label: "Element inspector", info: "" },
      { label: "Debugging and logging", info: "" },
      {
        label: "Dev tools",
        info: "Outline render, JavaScript CPU profiler, Redux DevTools integration, React Query devtools plugin, React Profiler integration",
      },
      { label: "Isolated components preview", info: "" },
      { label: "Screenshots & screen recording", info: "" },
      { label: "Replays", info: "" },
      { label: "Extended device emulator", info: "Phones and tablets" },
      {
        label: "Advanced device settings",
        info: "Device appearance, Text size, Home button and app switcher, Audio volume, Portrait/landscape orientation, Location, Localization, Permissions, Biometrics",
      },
      { label: "Connect mode", info: "" },
      { label: "Expo Router integration", info: "" },
      { label: "Network inspector", info: "" },
      { label: "Storybook integration", info: "" },
      { label: "Radon AI assistant", info: "" },
    ],
    featuresTeamManagement: [
      { label: "Multiple license management", info: "" },
      { label: "Centralized team billing", info: "" },
      { label: "Insights Dashboard with usage stats", info: "" },
    ],
    featuresSupport: [
      { label: "Early access to new features", info: "" },
      { label: "Priority support via email", info: "" },
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
      { label: "Single sign-on for the Radon IDE Portal", info: "" },
      { label: "Service-level agreement (SLA)", info: "" },
      { label: "Dedicated payment method and invoicing", info: "" },
      { label: "Onboarding meeting", info: "" },
      {
        label: "Expert React Native consulting",
        info: "",
      },
      { label: "Support via a dedicated Slack channel", info: "" },
    ],
  },
];
