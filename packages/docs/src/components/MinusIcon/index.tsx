import React from "react";

interface IconProps {
  className?: string;
  color?: string;
  size?: number;
}

const MinusIcon = ({ className, color = "currentColor", size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}>
    <path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M4 12h16"></path>
  </svg>
);

export default MinusIcon;
