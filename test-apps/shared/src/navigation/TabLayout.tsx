// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/

import React, { type ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { type IconProps } from "@expo/vector-icons/build/createIconSet";

import { useScheme } from "../Colors";

export function TabLayout() {
  const { colors, gap } = useScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        headerShown: false,
        tabBarStyle: {
          borderTopColor: colors.text,
          borderTopWidth: 1,
          backgroundColor: colors.darkerBackground,
          paddingTop: gap,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "home" : "home-outline"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "code-slash" : "code-slash-outline"}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

type TabBarIconProps = IconProps<ComponentProps<typeof Ionicons>["name"]>;
function TabBarIcon({ style, ...rest }: TabBarIconProps) {
  return <Ionicons size={28} style={[{ marginBottom: -3 }, style]} {...rest} />;
}
