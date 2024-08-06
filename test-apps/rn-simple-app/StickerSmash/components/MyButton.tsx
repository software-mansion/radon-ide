import { Button } from "react-native";

export default function MyButton() {
  return (
    <div>
      <Button title="FRYTKI" onPress={() => alert("Button clicked!")} />
    </div>
  );
}
