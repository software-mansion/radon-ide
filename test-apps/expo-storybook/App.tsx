import { StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { NiceButton } from "./components/NiceButton/NiceButton";
import { UglyButton } from "./components/UglyButton/UglyButton";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

function App() {
  return (
    <View style={styles.container}>
      <Text>Storybook test app</Text>
      <NiceButton text="test!" />
      <UglyButton />
    </View>
  );
}

let AppEntryPoint = App;

if (Constants.expoConfig?.extra?.storybookEnabled === "true") {
  AppEntryPoint = require("./.ondevice").default;
}

export default AppEntryPoint;
