import React from "react";

interface IconProps {
  className?: string;
  color?: string;
  size?: number;
}

const PlusIcon = ({ className, color = "currentColor", size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}>
    <path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 4v16M4 12h16"></path>
  </svg>
);

export default PlusIcon;
