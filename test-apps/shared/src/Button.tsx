import React from "react";
import { useScheme } from "./Colors";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";

type ButtonProps = {
  title: string;
  onPress: () => void;
  inline?: boolean;
};

export function Button({ title, onPress, inline }: ButtonProps) {
  const styles = useStyles({ inline });

  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  );
}

function useStyles({ inline }: { inline?: boolean }) {
  const { colors, gap } = useScheme();

  return StyleSheet.create({
    button: {
      marginHorizontal: inline ? -gap * 2 : 0,
      paddingHorizontal: gap * 2,
      paddingVertical: gap,
      backgroundColor: colors.darkerBackground,
      borderColor: colors.text,
      borderWidth: 1,
    },
  });
}
