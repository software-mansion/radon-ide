import { StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { NiceButton } from "./components/NiceButton/NiceButton";
import { UglyButton } from "./components/UglyButton/UglyButton";

function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      {/* <Details /> */}
      <NiceButton
        text="123"
        onPress={() => {
          console.log("CLICK");
        }}
      />
      <UglyButton />
    </View>
  );
}

let AppEntryPoint = App;

if (Constants.expoConfig?.extra?.storybookEnabled === "true") {
  AppEntryPoint = require("./.ondevice").default;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AppEntryPoint;
