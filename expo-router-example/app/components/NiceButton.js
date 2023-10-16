import { Button } from 'react-native';
import { preview } from '@preview';

export function NiceButton({ color, onPress }) {
  return (
    <Button
      title="Write some logs"
      color={color}
      onPress={onPress}
    />
  );
}

preview(<NiceButton color="blue" />);
preview(<NiceButton color="green" />);
preview(<NiceButton color="purple" />);
