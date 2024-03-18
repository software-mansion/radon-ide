import React from "react";
import { View, Text, StyleSheet } from "react-native";
import FontAwesome5 from "@expo/vector-icons/build/FontAwesome5";

const style = StyleSheet.create({
  container: {
    alignItems: "center",
  },
});

const TabIcon = ({ name, label, color, size }) => (
  <View style={style.container}>
    <FontAwesome5 name={name} color={color} size={size} />
    <Text style={{ marginTop: 5, color: color }}>{label}</Text>
  </View>
);

export default TabIcon;
