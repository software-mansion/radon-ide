import React from "react";
import { useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { preview } from "radon-ide";

import { Button } from "./Button";
import { gap, useScheme } from "./Colors";
import { Text } from "./Text";

preview(
  <Button
    title="Button"
    onPress={() => {
      console.log("console.log()");
    }}
  />
);

function printLogs() {
  // put breakpoint on the next line
  const text = "console.log()";
  console.log(text);
}

export function MainScreen() {
  const style = useStyle();

  return (
    <SafeAreaView style={style.container}>
      <Logo />
      <ScrollView>
        <View style={style.stepContainer}>
          <Step label="Create simulator/emulator">
            Create a simulator and an emulator and make sure it boots correctly.
          </Step>
          <Step label="Delete simulator/emulator">
            Delete previously added simulator and emulator.
          </Step>
          <Step label="Run project">
            Run project on selected platform and check if app loads.
          </Step>
          <Step label="Test console logs and breakpoints" onPress={printLogs}>
            Click the button to log messages. Add a breakpoint before
            console.log() and verify it stops there.
          </Step>
          <Step label="Jump from log entry to source code">
            Go to debug console view and click gray file and line number to jump
            to location of that console.log().
          </Step>
          <Step
            label="Check uncaught exceptions"
            onPress={() => {
              const tryToTrow = "expected error";
              throw new Error(tryToTrow);
            }}
          >
            Click a button to throw an exception and verify IDE catches that
            with "Uncaught exception" overlay.
          </Step>
          <Step label="Inspector button (left and right click)">
            Click inspector button, hover over components and jump to the
            component after click. Right click the selected component and verify
            it shows tree of nested components at the location of the click.
          </Step>
          <Step label="Device appearance and font settings">
            Change device appearance to dark and light mode and change font to
            be bigger or smaller.
          </Step>
          <Step label="Expo router integration in URL bar">
            Go to the second tab if Expo router is used and check if selecting
            paths in URL bar change the current route.
          </Step>
          <Step label="Component preview">
            Click "Open preview" on selected component and verify it also works
            with router integration.
          </Step>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function useStyle() {
  const { gap, colors } = useScheme();
  return StyleSheet.create({
    container: { flex: 1, gap: gap, backgroundColor: colors.background },
    stepContainer: { gap, marginHorizontal: gap * 4 },
  });
}

type StepProps = {
  label: string;
  children: string;
  onPress?: () => void;
};
function Step({ label, onPress, children }: StepProps) {
  const [expand, setExpand] = useState(false);

  let content = <Text>{"• " + label}</Text>;
  if (onPress) {
    content = <Button inline title={"• " + label} onPress={onPress} />;
  }

  return (
    <View>
      <View style={stepStyle.row}>
        {content}
        <ExpandArrow
          expanded={expand}
          onPress={() => setExpand((expanded) => !expanded)}
        />
      </View>
      {expand && <Text style={stepStyle.description}>{children}</Text>}
    </View>
  );
}
const stepStyle = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  description: { marginLeft: gap * 2, fontSize: 12 },
});

function Logo() {
  return (
    <View style={{ marginHorizontal: gap * 3 }}>
      <Image
        source={require("./assets/radon.png")}
        style={{ width: "100%", height: 200, objectFit: "contain" }}
      />
    </View>
  );
}

type ExpandArrowProps = {
  onPress: () => void;
  expanded: boolean;
};
function ExpandArrow({ expanded, onPress }: ExpandArrowProps) {
  const style = useExpandArrowStyle();
  return (
    <Pressable onPress={onPress} style={style.container}>
      <Text style={style.text}>{expanded ? "↑" : "↓"}</Text>
    </Pressable>
  );
}
function useExpandArrowStyle() {
  const { colors, gap } = useScheme();

  return StyleSheet.create({
    container: { paddingHorizontal: gap, justifyContent: "center" },
    text: { color: colors.text },
  });
}
