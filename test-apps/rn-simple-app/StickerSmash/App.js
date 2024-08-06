import { AppRegistry } from "react-native";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { preview } from "react-native-ide";
import Task, { Default, Pinned, Archived } from "./components/Task.stories.jsx";

// export { default } from "./.storybook"; // Render Storybook

export function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

AppRegistry.registerComponent("main", () => App);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

// preview(<Task />, [Default, Pinned, Archived]);
