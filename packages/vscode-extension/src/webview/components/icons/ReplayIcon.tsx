interface ReplayIconProps {
  color?: string;
}

const ReplayIcon = ({ color = "currentColor", ...rest }: ReplayIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    {...rest}>
    <path
      d="M12 13.8L19 18V6L12 10.2M12 18L12 6L3 12L12 18Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default ReplayIcon;
