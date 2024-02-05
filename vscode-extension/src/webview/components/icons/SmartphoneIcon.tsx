interface SmartphoneIconProps {
  color?: string;
}

function SmartphoneIcon({ color = "#fff", ...rest }: SmartphoneIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={32}
      height={32}
      viewBox="0 0 32 32"
      fill="none"
      {...rest}>
      <path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16.5 24.847v-.014M10.833 4h11.334C23.73 4 25 5.244 25 6.778v19.444C25 27.756 23.732 29 22.167 29H10.833C9.27 29 8 27.756 8 26.222V6.778C8 5.244 9.269 4 10.833 4Z"
      />
    </svg>
  );
}
export default SmartphoneIcon;
