import { ReactNode, useEffect, useState } from "react";
import "./KeybindingInfo.css";
import { useProject } from "../../providers/ProjectProvider";

interface KeybindingInfoProps {
  commandName: string;
}

function translateToUnicode(symbol: string) {
  let icons = {
    cmd: "⌘",
    ctrl: "⌃",
    alt: "⌥",
    option: "⌥",
    shift: "⇧",
    tab: "⇥",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
  };
  return icons[symbol.toLowerCase() as keyof typeof icons] || symbol.toUpperCase();
}

export const KeybindingInfo = ({ commandName }: KeybindingInfoProps) => {
  const { project } = useProject();
  const [keybinding, setKeybinding] = useState<string[]>([]);

  useEffect(() => {
    project.getCommandsCurrentKeyBinding(commandName).then((res) => {
      if (res) {
        const result = res?.split(/[+ ]/).map((key) => {
          key.trim();
          return translateToUnicode(key);
        });
        setKeybinding(result);
      } else {
        setKeybinding([]);
      }
    });
  }, []);

  return (
    <div className="keybinding">
      {" "}
      {keybinding.map((symbol, index) => {
        return (
          <span key={index} className="symbol">
            {symbol}
          </span>
        );
      })}
    </div>
  );
};
