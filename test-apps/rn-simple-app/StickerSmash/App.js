import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { preview } from "react-native-ide";
import Details from "./components/Details";
// import { Task } from "./components/Task";
import Task, { Default, Pinned, Archived } from "./components/Task.stories.jsx";

export { default } from "./.storybook"; // Render Storybook

export function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

const sampleTask = { id: 1, title: "Example Task", state: "TASK_INBOX" };

//preview(<Details />, [1]);

preview(
  <Task task={sampleTask} onArchiveTask={() => {}} onPinTask={() => {}} />,
  [Default, Pinned, Archived],
  0
);
