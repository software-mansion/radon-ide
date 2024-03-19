import * as Progress from "@radix-ui/react-progress";
import "./ProgressBar.css";

interface ProgressBarProps {
  progress: number;
}

const ProgressBar = ({ progress }: ProgressBarProps) => {
  return (
    <Progress.Root className="progress-bar-root" value={progress}>
      <Progress.Indicator
        className="progress-bar-indicator"
        style={{
          transform: `translateX(-${100 - progress}%)`,
          transition: progress > 0 ? "transform 660ms cubic-bezier(0.65, 0, 0.35, 1)" : "none",
        }}
      />
    </Progress.Root>
  );
};

export default ProgressBar;
