import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { preview } from "react-native-ide";

export default function Details() {
  const router = useRouter();
  return (
    <View>
      <Text
        onPress={() => {
          console.log("FRYTKI ", 1);
        }}
      >
        Details Screen
      </Text>
    </View>
  );
}

preview(<Details />);
