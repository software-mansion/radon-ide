import { Button } from "react-native";
import { preview } from "@preview";

export function UglyButton() {
  return (
    <Button
      title="Bleh"
      onPress={() => {
        console.log("Pressed!");
        console.warn("Warning! Bleh");
        throw new Error("Bleh");
      }}
    />
  );
}

preview(<UglyButton />);
