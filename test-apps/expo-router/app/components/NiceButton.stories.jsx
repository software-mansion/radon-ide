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

export const DynamicDynamicRE = () => (
  <NiceButton color="red" onPress={() => console.log("Red button pressed!")} />
);

DynamicDynamicRE.storyName = "red";

export let TheLongestNameOfStorybookStoryAkaGreenButton = () => (
  <NiceButton
    color="green"
    onPress={() => console.log("Green button pressed!")}
  />
);

TheLongestNameOfStorybookStoryAkaGreenButton.storyName = "green";

const Template = (args) => <NiceButton {...args} />;

export const DynamicDynamicR = Template.bind({});
DynamicDynamicR.args = {
  color: "purple",
  onPress: () => console.log("Dynamic button pressed!"),
};

DynamicDynamicR.storyName = "dynamic";


export const AA = () => (
  <NiceButton color="#1b1b1b" onPress={() => console.log("Button pressed!")} />
);


export const AB = () => (
  <NiceButton color="#12a12a" onPress={() => console.log("Button pressed!")} />
);

export const Z = () => (
  <NiceButton color="#ff11aa" onPress={() => console.log("Button pressed!")} />
);

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

export const G = () => (
  <NiceButton color="#556677" onPress={() => console.log("Button G pressed!")} />
);

export const H = () => (
  <NiceButton color="#aabb00" onPress={() => console.log("Button H pressed!")} />
);

export const I = () => (
  <NiceButton color="#00cccc" onPress={() => console.log("Button I pressed!")} />
);

export const J = () => (
  <NiceButton color="#ff0077" onPress={() => console.log("Button J pressed!")} />
);

export const K = () => (
  <NiceButton color="#ddff11" onPress={() => console.log("Button K pressed!")} />
);

export const L = () => (
  <NiceButton color="#00aaff" onPress={() => console.log("Button L pressed!")} />
);

export const M = () => (
  <NiceButton color="#f0f0f0" onPress={() => console.log("Button M pressed!")} />
);

export const N = () => (
  <NiceButton color="#11ffee" onPress={() => console.log("Button N pressed!")} />
);

export const O = () => (
  <NiceButton color="#221100" onPress={() => console.log("Button O pressed!")} />
);

export const P = () => (
  <NiceButton color="#ff55aa" onPress={() => console.log("Button P pressed!")} />
);

export const Q = () => (
  <NiceButton color="#4a0033" onPress={() => console.log("Button Q pressed!")} />
);

export const R = () => (
  <NiceButton color="#ffaa22" onPress={() => console.log("Button R pressed!")} />
);

export const S = () => (
  <NiceButton color="#00bb99" onPress={() => console.log("Button S pressed!")} />
);

export const T = () => (
  <NiceButton color="#334455" onPress={() => console.log("Button T pressed!")} />
);

export const U = () => (
  <NiceButton color="#9999ff" onPress={() => console.log("Button U pressed!")} />
);

export const V = () => (
  <NiceButton color="#774422" onPress={() => console.log("Button V pressed!")} />
);

export const W = () => (
  <NiceButton color="#66ddaa" onPress={() => console.log("Button W pressed!")} />
);

export const X = () => (
  <NiceButton color="#ff9988" onPress={() => console.log("Button X pressed!")} />
);

export const Y = () => (
  <NiceButton color="#4466bb" onPress={() => console.log("Button Y pressed!")} />
);
