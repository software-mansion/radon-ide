import React from "react";
import { Button } from "react-native";

export function NiceButton({ color, onPress }) {
  return <Button title="Write logs" color={color} onPress={onPress} />;
}

export default {
  title: "NiceButton",
  component: NiceButton,
};

export const Default = () => (
  <NiceButton color="#007bff" onPress={() => console.log("Button pressed!")} />
);

Default.storyName = "default";

export const RedButton = () => (
  <NiceButton color="red" onPress={() => console.log("Red button pressed!")} />
);

RedButton.storyName = "red";

export const GreenButton = () => (
  <NiceButton
    color="green"
    onPress={() => console.log("Green button pressed!")}
  />
);

GreenButton.storyName = "green";

const Template = (args) => <NiceButton {...args} />;

export const Dynamic = Template.bind({});
Dynamic.args = {
  color: "purple",
  onPress: () => console.log("Dynamic button pressed!"),
};

Dynamic.storyName = "dynamic";
