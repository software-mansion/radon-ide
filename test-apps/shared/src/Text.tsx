import React from "react";
import { useScheme } from "./Colors";
import { PropsWithChildren } from "react";
import { Text as RNText, StyleSheet } from "react-native";

export function Text({
  children,
  ...props
}: PropsWithChildren<RNText["props"]>) {
  const styles = useStyles();
  return (
    <RNText {...props} style={[props.style, styles.text]}>
      {children}
    </RNText>
  );
}

function useStyles() {
  const { colors } = useScheme();

  return StyleSheet.create({
    text: { color: colors.text },
  });
}
