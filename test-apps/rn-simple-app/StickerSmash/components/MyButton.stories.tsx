import React from "react";
import MyButton from "./MyButton";

// Default export that contains component and story metadata
export default {
  title: "MyButton",
  component: MyButton,
};

// Named exports that define the stories
export const Primary = () => <MyButton primary />;
Primary.storyName = "Primary";

export const Secondary = () => <MyButton />;
Secondary.storyName = "Secondary";
