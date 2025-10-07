import "./InfoBar.css";

interface InfoBarProps {
  data?: Record<string, string>;
  ref: React.RefObject<HTMLDivElement | null>;
}

const InfoBar = ({ data, ref }: InfoBarProps) => {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  const values = Object.values(data);
  const displayText = values.join(" | ");

  return (
    <div ref={ref} className="info-bar">
      {displayText}
    </div>
  );
};

export default InfoBar;
