import * as React from 'react';

import { NativeExceptionTriggerViewProps } from './NativeExceptionTrigger.types';

export default function NativeExceptionTriggerView(props: NativeExceptionTriggerViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
