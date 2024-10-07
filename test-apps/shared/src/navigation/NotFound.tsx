import React from "react";
import { Link, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Text } from "../Text";
import { useScheme } from "../Colors";

export function NotFoundScreen() {
  const styles = useStyle();
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text style={styles.header}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

function useStyle() {
  const { colors, gap } = useScheme();

  return StyleSheet.create({
    container: {
      flex: 1,
      gap: gap,
      backgroundColor: colors.background,
      alignItems: "center",
      padding: gap,
    },
    header: { fontSize: 18, fontWeight: "bold" },
    link: { textDecorationLine: "underline" },
  });
}
