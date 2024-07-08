import { ReactNode, useEffect, useState } from "react";
import "./KeybindingInfo.css";
import { useProject } from "../../providers/ProjectProvider";

interface KeybindingInfoProps {
  commandName: string;
}

interface SymbolProps {
  children: ReactNode;
}

const Symbol = ({ children }: SymbolProps) => {
  return <span className="symbol">{children}</span>;
};

export const KeybindingInfo = ({ commandName }: KeybindingInfoProps) => {
  const { project } = useProject();
  const [keybinding, setKeybinding] = useState<string[]>([]);

  function translateToUnicode(symbol: string) {
    let icons = {
      cmd: "\u2318", // ⌘
      ctrl: "\u2303", // ⌃
      alt: "\u2325", // ⌥
      option: "\u2325", // ⌥
      shift: "\u21E7", // ⇧
      tab: "\u21E5", // ⇥
      up: "\u2191", // ↑
      down: "\u2193", // ↓
      left: "\u2190", // ←
      right: "\u2192", // →
    };
    return icons[symbol.toLowerCase() as keyof typeof icons] || symbol.toUpperCase();
  }

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
        return <Symbol key={index}>{symbol}</Symbol>;
      })}
    </div>
  );
};
