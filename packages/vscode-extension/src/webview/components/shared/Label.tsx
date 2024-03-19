import "./Label.css";

interface LabelProps {
  children: React.ReactNode;
}

function Label({ children }: LabelProps) {
  return <p className="label">{children}</p>;
}

export default Label;
