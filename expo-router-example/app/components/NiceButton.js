import { Button } from 'react-native';
import { preview } from '@preview';

export function NiceButton({ color }) {
  return <Button title="sdfkljsdfd" color={color} onPress={() => {
    console.log("nice");
  }} />;
}

preview(<NiceButton color="blue" />);
preview(<NiceButton color="green" />);
preview(<NiceButton color="purple" />);
