export const pricingIndividualData = [
  {
    plan: "FREE",
    price: { monthly: 0, yearly: 0 },
    yearlyFullPrice: "",
    label: "For non-commercial use",
    buttonLabel: "Install",
    stylingFilled: false,
    featuresAll: [
      { label: "Element inspector", info: "" },
      { label: "Debugging and logging", info: "" },
      {
        label: "Dev tools",
        info: "Outline render, JavaScript CPU profiler, Redux DevTools integration, React Query devtools plugin, React Profiler integration",
      },
      { label: "Isolated components preview", info: "" },
      { label: "Basic device emulator", info: "Phones only" },
      {
        label: "Basic device settings",
        info: "Device appearance, Text size, Home button and app switcher, Audio volume",
      },
      { label: "Connect mode", info: "" },
      { label: "Expo Router integration", info: "" },
      { label: "Network inspector", info: "" },
      { label: "Support via GitHub issues", info: "" },
    ],
  },
  {
    plan: "PRO",
    price: { monthly: 25, yearly: 250 },
    yearlyFullPrice: 300,
    label: "For professional developers",
    buttonLabel: "Start 14-day trial",
    stylingFilled: true,
    featuresAll: [
      { label: "Screenshots & screen recording", info: "" },
      { label: "Replays", info: "" },
      { label: "Extended device emulator", info: "Phones and tablets" },
      {
        label: "Advanced device settings",
        info: "Device appearance, Text size, Home button and app switcher, Audio volume, Portrait/landscape orientation, Location, Localization, Permissions, Biometrics",
      },
      { label: "Storybook integration", info: "" },
      { label: "Radon AI assistant", info: "" },
      { label: "Early access to new features", info: "" },
      { label: "Priority support via email", info: "" },
    ],
  },
];
