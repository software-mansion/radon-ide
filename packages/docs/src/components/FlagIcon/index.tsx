import * as React from "react";

interface FlagIconProps {
  color?: string;
}

function FlagIcon({ color = "#001A72", ...rest }: FlagIconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}>
      <path
        d="M4 21v-7m0 0V4h16l-5 5 5 5H4z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default FlagIcon;
