import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { View } from "react-native";
import { NiceButton } from "./NiceButton";

const meta = {
  title: "NiceButton",
  component: NiceButton,
  args: {
    text: "Button",
    onPress: () => {
      console.log("click!");
    },
  },
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof NiceButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
export const Changed: Story = {
  args: {
    text: "foo!",
    onPress: () => {
      console.log("foo!");
    },
  },
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: "blue" }}>
        <Story />
      </View>
    ),
  ],
};
