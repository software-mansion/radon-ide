import { useScheme } from "@/shared/Colors";
import { View } from "react-native";

export default function TabTwoScreen() {
  const { colors } = useScheme();

  return <View style={{ backgroundColor: colors.background, flex: 1 }} />;
}
