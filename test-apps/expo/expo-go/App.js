import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';

function handleClick() {
  alert('Button Clicked');
  console.log('Button clicked');
}

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app hello!</Text>
      <StatusBar style="auto" />
      <Button title="Click me" onPress={handleClick} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
