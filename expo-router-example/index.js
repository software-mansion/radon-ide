import 'expo-router/entry';
import './preview';
import RNVersion from 'react-native/Libraries/Core/ReactNativeVersion';
import ReactNativeFeatureFlags from 'react-native/Libraries/ReactNative/ReactNativeFeatureFlags';

if (RNVersion.version.major === 0 && RNVersion.version.minor <= 71) {
  ReactNativeFeatureFlags.shouldEmitW3CPointerEvents = false;
}
