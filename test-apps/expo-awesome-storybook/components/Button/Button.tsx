import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { preview } from "react-native-ide";

interface MyButtonProps {
  // onPress: () => void;
  text: string;
}

export const MyButton = ({ text }: MyButtonProps) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => {
        console.log("click!");
      }}
    >
      <Text style={styles.text}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    paddingVertical: 8,
    backgroundColor: "purple",
    alignSelf: "flex-start",
    borderRadius: 8,
  },
  text: { color: "white", fontSize: 16, fontWeight: "bold" },
});

preview(<MyButton text="Gello world" />);
