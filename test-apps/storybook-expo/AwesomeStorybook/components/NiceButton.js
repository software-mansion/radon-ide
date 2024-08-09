import React from "react";
import { Button } from "react-native";
import { preview } from "react-native-ide";

export const NiceButton = ({ text, onPress }) => {
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
