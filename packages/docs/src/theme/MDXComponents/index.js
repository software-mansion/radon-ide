import { MDXComponents } from '@swmansion/t-rex-ui';
import styles from './styles.module.css';

export default function MDXComponentsWrapper(props) {
  return (
    <div style={styles.enableStyles}>
      <MDXComponents {...props} />;
    </div>
  );
}
