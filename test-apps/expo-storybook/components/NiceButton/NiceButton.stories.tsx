import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { View } from "react-native";
import { NiceButton } from "./NiceButton";
import { preview } from "react-native-ide";

const meta = {
  component: NiceButton,
  args: {
    text: "Button",
  },
} satisfies Meta<typeof NiceButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
export const NewText: Story = {
  args: {
    text: "booo!",
  },
  decorators: [
    (Story) => (
      <View style={{ padding: 50 }}>
        <Story />
      </View>
    ),
  ],
};
export const Foo: Story = {
  args: {
    text: "foo!",
  },
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: "blue" }}>
        <Story />
      </View>
    ),
  ],
};

preview(<NiceButton text="222" />);
