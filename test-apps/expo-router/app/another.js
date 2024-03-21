import { View, Text } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { NiceButton } from './components/NiceButton';
import { UglyButton } from './components/UglyButton';

export default function Another() {
  const router = useRouter();
  const params = useGlobalSearchParams();
  return (
    <View>
      <Text
        onPress={() => {
          // Go back to the previous screen using the imperative API.
          router.back();
        }}>
        Another screen ({params?.id})
      </Text>
      <NiceButton />
      <UglyButton />
    </View>
  );
}
