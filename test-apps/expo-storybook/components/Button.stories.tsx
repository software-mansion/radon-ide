import type { Meta, StoryObj } from "@storybook/react";
import { MyButton } from "./Button";

const meta = {
  title: "MyButton",
  component: MyButton,
  args: {
    text: "Hello world",
  },
} satisfies Meta<typeof MyButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
export const DiffText: Story = {
  args: {
    text: "Gello world",
  },
};
