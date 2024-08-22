import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { View } from "react-native";
import { YetAnotherComponent } from "./YetAnotherComponent";

const meta = {
  title: "YetAnotherComponent",
  component: YetAnotherComponent,
  args: {},
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof YetAnotherComponent>;

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
