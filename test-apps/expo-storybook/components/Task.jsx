import { StyleSheet, TextInput, View } from 'react-native';
import { styles } from './styles';

export const Task = ({
  task: { id, title, state },
  onArchiveTask,
  onPinTask,
}) => {
  return (
    <View style={styles.listItem}>
      <TextInput value={title} editable={false} />
    </View>
  );
};
