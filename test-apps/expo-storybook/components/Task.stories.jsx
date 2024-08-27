import { Task } from './Task';

export default {
  title: 'Task',
  component: Task,
  argTypes: {
    onPinTask: { action: 'onPinTask' },
    onArchiveTask: { action: 'onArchiveTask' },
  },
};

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
  args: { task: { ...Default.args.task, state: 'TASK_PINNED' } },
};

export const Archived = {
  args: { task: { ...Default.args.task, state: 'TASK_ARCHIVED' } },
};