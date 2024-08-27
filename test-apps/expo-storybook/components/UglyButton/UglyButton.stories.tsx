import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { View } from "react-native";
import { UglyButton } from "./UglyButton";

const meta = {
  title: "UglyButton",
  component: UglyButton,
  args: {},
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof UglyButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
export const MoreDecorators: Story = {
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: "red" }}>
        <Story />
      </View>
    ),
  ],
};
