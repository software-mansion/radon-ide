import React from "react";
import { Button } from "react-native";

export function NiceButton({ color, onPress }) {
  return <Button title="Write logs" color={color} onPress={onPress} />;
}

export default {
  title: "NiceButtonTitle",
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

export let TheLongestNameOfStorybookStoryAkaGreenButton = () => (
  <NiceButton
    color="green"
    onPress={() => console.log("Green button pressed!")}
  />
);

TheLongestNameOfStorybookStoryAkaGreenButton.storyName = "green";

const Template = (args) => <NiceButton {...args} />;

export const Dynamic = Template.bind({});
Dynamic.args = {
  color: "purple",
  onPress: () => console.log("Dynamic button pressed!"),
};

Dynamic.storyName = "dynamic";

export const A = () => (
  <NiceButton color="#ff11aa" onPress={() => console.log("Button A pressed!")} />
);

export const B = () => (
  <NiceButton color="#22bb33" onPress={() => console.log("Button B pressed!")} />
);

export const C = () => (
  <NiceButton color="#3344cc" onPress={() => console.log("Button C pressed!")} />
);

export const D = () => (
  <NiceButton color="#8855ff" onPress={() => console.log("Button D pressed!")} />
);

export const E = () => (
  <NiceButton color="#ee7733" onPress={() => console.log("Button E pressed!")} />
);

export const F = () => (
  <NiceButton color="#997744" onPress={() => console.log("Button F pressed!")} />
);
