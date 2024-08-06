import { Button } from "react-native";
import { preview } from "react-native-ide";

export function NiceButton({ color, onPress }) {
  return <Button title="Write logs" color={color} onPress={onPress} />;
}

preview(<NiceButton color="blue" />);
preview(<NiceButton color="green" />);
preview(<NiceButton color="purple" />);
