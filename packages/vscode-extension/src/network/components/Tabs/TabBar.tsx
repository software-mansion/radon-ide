import { useTabBar } from "../../providers/TabBarProvider";
import "./TabBar.css";

interface TabBarProps {
  ref: React.RefObject<HTMLDivElement | null>;
}

const TabBar = ({ ref }: TabBarProps) => {
  const { content } = useTabBar();

  return (
    <div ref={ref} className="info-bar">
      {content}
    </div>
  );
};

export default TabBar;
