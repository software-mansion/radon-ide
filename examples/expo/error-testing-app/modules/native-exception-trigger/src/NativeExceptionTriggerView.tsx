import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { NativeExceptionTriggerViewProps } from './NativeExceptionTrigger.types';

const NativeView: React.ComponentType<NativeExceptionTriggerViewProps> =
  requireNativeViewManager('NativeExceptionTrigger');

export default function NativeExceptionTriggerView(props: NativeExceptionTriggerViewProps) {
  return <NativeView {...props} />;
}
