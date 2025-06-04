import * as React from "react";

interface UserIconProps {
  color?: string;
}

function UserIcon({ color = "#001A72", ...rest }: UserIconProps) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}>
      <path
        d="M16 15H8a4 4 0 00-4 4v2h16v-2a4 4 0 00-4-4zM12 11a4 4 0 100-8 4 4 0 000 8z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default UserIcon;
