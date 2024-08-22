import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { NiceButton } from "../NiceButton/NiceButton";
import { preview } from "react-native-ide";

export const ButtonCombo = () => {
  const styles = {
    loginScreenButton: {
      marginRight: 40,
      marginLeft: 40,
      marginTop: 100,
      paddingTop: 10,
      paddingBottom: 10,
      backgroundColor: "#aaa",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#fff",
    },
    loginText: {
      color: "#fff",
      textAlign: "center",
      paddingLeft: 10,
      paddingRight: 10,
    },
  };
  return (
    <TouchableOpacity
    // style={styles.loginScreenButton
    >
      <NiceButton text="123" />
      <NiceButton text="123" />
      <NiceButton text="123" />
    </TouchableOpacity>
  );
};

preview(<ButtonCombo />);
