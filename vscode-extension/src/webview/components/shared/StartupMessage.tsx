import { useEffect, useState } from "react";
import "./StartupMessage.css";

const dots = ["", ".", "..", "..."];

function StartupMessage({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((index + 1) % dots.length);
    }, 350);

    return () => clearInterval(interval);
  });

  return (
    <div className="startup-message-wrapper">
      {children}
      <div className="startup-message-dots">{dots[index]}</div>
    </div>
  );
}

export default StartupMessage;
