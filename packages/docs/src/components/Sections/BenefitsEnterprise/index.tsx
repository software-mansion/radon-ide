import React from "react";
import styles from "./styles.module.css";
import BenefitCard from "./BenefitCard";
import TerminalIcon from "../../EnterpriseIcons/TerminalIcon";
import RocketIcon from "../../EnterpriseIcons/RocketIcon";
import SquareCodeIcon from "../../EnterpriseIcons/SquareCodeIcon";
import SquareCheckIcon from "../../EnterpriseIcons/SquareCheckIcon";
import UserCheckIcon from "../../EnterpriseIcons/UserCheckIcon";
import MessageSquareCodeicon from "../../EnterpriseIcons/MessageSquareCodeIcon";

const benefits = [
  {
    icon: <TerminalIcon />,
    title: "Better dev experience",
    description:
      "Free your team from constant context switching. With Radon, devs can run simulators, preview components, and debug errors directly inside VSCode.",
  },
  {
    icon: <RocketIcon />,
    title: "Faster time to market",
    description:
      "With breakpoints, instant previews, and built-in tools for Network Inspector, Redux, and React Query, your team spends less time troubleshooting and more time shipping features.",
  },
  {
    icon: <SquareCodeIcon />,
    title: "Higher code quality",
    description:
      "Radon automatically stops at runtime exceptions and highlights parts of your app that need optimization, helping your team catch problems early and deliver stable apps.",
  },
  {
    icon: <SquareCheckIcon />,
    title: "Lower operational overhead",
    description:
      "Simple installation and setup make Radon easy to roll out across organizations. We know no one likes red tape and complex infrastructure.",
  },
  {
    icon: <UserCheckIcon />,
    title: "Fast & easy onboarding",
    description:
      "Comprehensive documentation and resources help new developers get to know our React Native IDE faster, lowering ramp-up costs.",
  },
  {
    icon: <MessageSquareCodeicon />,
    title: "Radon keeps growing with you",
    description:
      "We keep expanding Radon based on research, community input, and feedback from teams like yours so new features truly make devs’ lives easier.",
  },
];

export default function BenefitsEnterprise() {
  return (
    <div className={styles.sectionContainer}>
      <div className={styles.title}>
        <h2>
          What makes <span>Radon</span>
          <br /> the right fit for your business?
        </h2>
      </div>
      <div className={styles.benefitsContainer}>
        {benefits.map((benefit, index) => (
          <BenefitCard
            key={index}
            icon={benefit.icon}
            title={benefit.title}
            description={benefit.description}
          />
        ))}
      </div>
    </div>
  );
}
