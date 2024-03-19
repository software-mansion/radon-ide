interface ErrorIconProps {
  color: string;
}

const ErrorIcon = ({ color = "#fff", ...rest }: ErrorIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={26}
    height={26}
    viewBox="0 0 24 24"
    fill="none"
    {...rest}>
    <path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m16 8-8 8m0-8 8 8m5-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </svg>
);
export default ErrorIcon;
