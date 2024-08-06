import { preview } from "react-native-ide";
import Task from './Task';

export const ActionsData = {
  // onArchiveTask: fn(),
  // onPinTask: fn(),
};

const meta = {
  // export default {
  component: Task,
  title: 'Task',
  tags: ['autodocs'],
  //👇 Our exports that end in "Data" are not stories.
  excludeStories: /.*Data$/,
  args: {
    ...ActionsData,
  },
};

export default meta;

export const Default = {
    args: {
      task: {
        id: '1',
        title: 'Test Task',
        state: 'TASK_INBOX',
      },
    },
  };
  
  export const Pinned = {
    args: {
      task: {
        ...Default.args.task,
        state: 'TASK_PINNED',
      },
    },
  };
  
  export const Archived = {
    args: {
      task: {
        ...Default.args.task,
        state: 'TASK_ARCHIVED',
      },
    },
  };


preview(meta, [Default, Pinned, Archived]);
