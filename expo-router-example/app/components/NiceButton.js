import { Button } from "react-native";
import { preview } from "@preview";

export function NiceButton({ color }) {
  return (
    <Button
      title="Write some logs"
      color={color}
      onPress={() => {
        console.log("Nice button pressed (log)");
        console.warn("Nice button pressed (warn)");
        throw new Error("from nice button");
      }}
    />
  );
}

preview(<NiceButton color="blue" />);
preview(<NiceButton color="green" />);
preview(<NiceButton color="purple" />);
