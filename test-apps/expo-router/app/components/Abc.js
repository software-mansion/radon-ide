import { Button } from "react-native";
import { preview } from "react-native-ide";

export function Abc({ color }) {
  return <Button title="Write" color={color} />;
}

preview(<Abc color="blue" />);
preview(<Abc color="purple" />);
