import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { preview } from "react-native-ide";

interface NiceButtonProps {
  text: string;
}

export const NiceButton = ({ text }: NiceButtonProps) => {
  const styles = {
    loginScreenButton: {
      marginRight: 40,
      marginLeft: 40,
      marginTop: 100,
      paddingTop: 10,
      paddingBottom: 10,
      backgroundColor: "#1E6738",
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
    <TouchableOpacity style={styles.loginScreenButton}>
      <Text style={styles.loginText}>{text}</Text>
    </TouchableOpacity>
  );
};

preview(<NiceButton text="123" />);
preview(<NiceButton text="ABC" />);
preview(<NiceButton text="ZYX" />);
