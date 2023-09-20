import { Button } from 'react-native';
import { preview } from '@preview';

export function UglyButton() {
  return <Button title="Bleh" />;
}

preview(<UglyButton />);
