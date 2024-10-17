import fs from "fs";
import path from "path";
import { isArray } from "lodash";
import { decodeArrayStream } from "@msgpack/msgpack";
import { BuildProgressProcessor } from "./BuildProgressProcessor";
import { Logger } from "../Logger";

//all constants in ms
const CREATE_READ_STREAM_TIMEOUT = 3000;

export class BuildIOSProgressProcessor implements BuildProgressProcessor {
  private buildDescriptionPath: string = "";
  private completedTasks: number = 0;
  private tasksToComplete: number = 0;

  constructor(private progressListener: (newProgress: number) => void) {}

  private async openTasksStoreIfExists(): Promise<fs.ReadStream> {
    const taskStorePath = path.join(this.buildDescriptionPath, "task-store.msgpack");
    if (fs.existsSync(taskStorePath)) {
      return fs.createReadStream(taskStorePath);
    }

    return new Promise<fs.ReadStream>((res, rej) => {
      const watcher = fs.watch(this.buildDescriptionPath, (eventType, filename) => {
        // eventType is either 'rename' or 'change'.
        // On most platforms (includeing macOS), 'rename' is emitted whenever a filename appears or disappears in the directory.
        // for more information refer to https://nodejs.org/docs/latest/api/fs.html#fswatchfilename-options-listener
        if (eventType === "rename" && filename === "task-store.msgpack") {
          watcher.close();
          res(fs.createReadStream(taskStorePath));
        }
      });
      setTimeout(() => {
        watcher.close();
        rej(
          new Error(
            `File did not exists and was not created for ${CREATE_READ_STREAM_TIMEOUT / 1000}s.`
          )
        );
      }, CREATE_READ_STREAM_TIMEOUT);
    });
  }

  private async countTasksToComplete() {
    try {
      let buildDescriptionPathReadStream = await this.openTasksStoreIfExists();
      const tasksStream = decodeArrayStream(buildDescriptionPathReadStream);
      let tasksToComplete = 0;
      for await (const task of tasksStream) {
        // task-store stores information about actual tasks and "virtual nodes" of the build graph,
        // the first item in a task array seems to be dedicated to the location of a script to be called so it is empty for virtual nodes that we don't want to count.
        if (isArray(task) && !task[0]) {
          continue;
        }
        tasksToComplete++;
      }
      this.tasksToComplete = tasksToComplete;
    } catch (err: any) {
      Logger.warn(`Build iOS progress processor: ${err}`);
    }
  }

  private async updateProgress() {
    if (!this.tasksToComplete) {
      return;
    }
    this.progressListener(Math.min(0.999, this.completedTasks / this.tasksToComplete));
  }

  async processLine(line: string) {
    const buildDescriptionPathMatch = /Build description path: ([^]+)/m.exec(line);

    if (buildDescriptionPathMatch) {
      this.buildDescriptionPath = buildDescriptionPathMatch[1];
      this.countTasksToComplete();
    }
    const taskExecutedMatch = /^[^\s\/]+ [\/\[]/m.exec(line);
    if (taskExecutedMatch) {
      this.completedTasks++;
      this.updateProgress();
    }
  }
}
