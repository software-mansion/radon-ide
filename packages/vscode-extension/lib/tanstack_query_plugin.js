import {
  QueryClient
} from '@tanstack/react-query';
import {
  broadcastQueryClient
} from './plugins/react-query-devtools';
import {
  register,
} from './expo_dev_plugins';

register('RNIDE-react-query-devtools');

const origMount = QueryClient.prototype.mount;

QueryClient.prototype.mount = function (...args) {
  broadcastQueryClient('RNIDE-react-query-devtools', this);
  return origMount.apply(this, args);
};
