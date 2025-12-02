import { Sentiment } from "../common/types";
import { EditorBindings } from "./EditorBindings";
import { Telemetry } from "./telemetry";

export class FeedbackGenerator {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly _editorBindings: EditorBindings
  ) {}

  public async sendFeedback(
    sentiment: Sentiment,
    options: {
      message?: string;
      includeLogs?: boolean;
    }
  ) {
    this.telemetry.sendTelemetry(`feedback:${sentiment}`, { message: options.message });
  }
}
