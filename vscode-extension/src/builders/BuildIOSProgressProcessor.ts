import { decodeArrayStream } from "@msgpack/msgpack";
import fs from "fs";
import { BuildProgressProcessor } from "./BuildProgressProcessor";
import { isArray } from "lodash";
import path from "path";
import { Logger } from "../Logger";
import { Project } from "../project/project";

//all constants in ms
const CREATE_READ_STREAM_TIMEOUT = 2000;
const FAKE_UPDATE_PROGRESS_DURATION = 100000;
const FAKE_UPDATE_PROGRESS_INTERVAL = 201;

export class BuildIOSProgressProcessor implements BuildProgressProcessor {
  private buildDescriptionPath: string = "";
  private buildDescriptionPathReadStream: fs.ReadStream | undefined;
  private completedTasks: number = 0;
  private tasksToComplete: number = 0;
  private shouldUseFakeProgress: boolean = false;

  private async createReadStream() {
    const taskStorePath = path.join(this.buildDescriptionPath, "task-store.msgpack");
    if (fs.existsSync(taskStorePath)) {
      this.buildDescriptionPathReadStream = fs.createReadStream(taskStorePath);
      return;
    }

    const timer = new Promise((_res, rej) => {
      setTimeout(() => {
        rej(
          new Error(
            `File did not exists and was not created for ${CREATE_READ_STREAM_TIMEOUT / 1000}s.`
          )
        );
      }, CREATE_READ_STREAM_TIMEOUT);
    });
    let watcher;
    const createReadStreamPromise = new Promise<void>((res, _) => {
      watcher = fs.watch(this.buildDescriptionPath, (eventType, filename) => {
        if (eventType === "rename" && filename === "task-store.msgpack") {
          this.buildDescriptionPathReadStream = fs.createReadStream(taskStorePath);
          res();
        }
      });
    });

    const result = Promise.race([timer, createReadStreamPromise]);
    result.finally(() => {
      watcher!.close();
    });
    return result;
  }

  private async countTasksToComplete() {
    try {
      await this.createReadStream();
      if (!this.buildDescriptionPathReadStream) {
        return;
      }
      const tasksStream = decodeArrayStream(this.buildDescriptionPathReadStream);
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
      Logger.warn(err);
      Logger.debug("Swiching to fake stage Progress...");
      this.shouldUseFakeProgress = true;
      this.fakeUpdateProgress();
    }
  }

  private async updateProgress() {
    if (!this.tasksToComplete) {
      return;
    }
    Project.currentProject!.updateStageProgress(this.completedTasks / this.tasksToComplete);
  }

  private async fakeUpdateProgress() {
    let i = 0;
    const noOfIterations = Math.floor(
      FAKE_UPDATE_PROGRESS_DURATION / FAKE_UPDATE_PROGRESS_INTERVAL
    );
    const interval = setInterval(() => {
      Project.currentProject!.updateStageProgress((1 / noOfIterations) * i);
      i++;
      if (i > noOfIterations) {
        clearInterval(interval);
      }
    }, FAKE_UPDATE_PROGRESS_INTERVAL);
  }

  async processLine(line: string) {
    if (this.shouldUseFakeProgress) {
      return;
    }
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
