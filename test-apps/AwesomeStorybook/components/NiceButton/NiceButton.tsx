import React from "react";
import { Button } from "react-native";
import { preview } from "react-native-ide";

interface NiceButtonProps {
  onPress: () => void;
  text: string;
}

export const NiceButton = ({ text, onPress }: NiceButtonProps) => {
  return <Button title={text} onPress={onPress} />;
};

preview(
  <NiceButton
    text="123"
    onPress={() => {
      console.log("CLICK");
    }}
  />
);
