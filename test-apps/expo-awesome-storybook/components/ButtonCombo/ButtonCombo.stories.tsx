import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { View } from "react-native";
import { ButtonCombo } from "./ButtonCombo";

const meta = {
  title: "ButtonCombo",
  component: ButtonCombo,
} satisfies Meta<typeof ButtonCombo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
export const WithPadding: Story = {
  decorators: [
    (Story) => (
      <View style={{ padding: 20 }}>
        <Story />
      </View>
    ),
  ],
};
export const WithBackground: Story = {
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: "purple" }}>
        <Story />
      </View>
    ),
  ],
};
