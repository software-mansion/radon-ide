/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { useColorScheme } from "react-native";

export const Colors = {
  light: {
    text: "#001A72",
    mainButton: "#57B495",
    background: "#F8F9FF",
    darkerBackground: "#EEF0FF",
    green: "#5FC095",
  },
  dark: {
    text: "#F8F9FF",
    mainButton: "#57B495",
    background: "#001A72",
    darkerBackground: "#EEF0FF",
    green: "#5FC095",
  },
} as const;

export const gap = 8;
export function useScheme() {
  return {
    gap,
    colors: useColorScheme() === "dark" ? Colors.dark : Colors.light,
  };
}
