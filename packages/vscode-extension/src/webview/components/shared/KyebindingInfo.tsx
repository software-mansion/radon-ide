import { useEffect, useState } from "react";
import "./KeybindingInfo.css";
import { useProject } from "../../providers/ProjectProvider";

interface KeybindingInfoProps {
  commandName: string;
}

export const KeybindingInfo = ({ commandName }: KeybindingInfoProps) => {
  const { project } = useProject();
  const [keybinding, setKeybinding] = useState("");

  useEffect(() => {
    project.getCommandsCurrentKeyBinding(commandName).then((res) => {
      setKeybinding(res ?? "");
    });
  }, []);

  return <div className="keybinding"> {keybinding}</div>;
};
