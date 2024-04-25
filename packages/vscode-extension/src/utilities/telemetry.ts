import TelemetryReporter from "@vscode/extension-telemetry";
import { extensionContext } from "./extensionContext";

const PUBLIC_INSIGHTS_KEY = "6709dbd6-92e7-40f6-be09-618db8a85ce9";

let reporter: TelemetryReporter | undefined;

export function getTelemetryReporter(): TelemetryReporter {
  if (!reporter) {
    reporter = new TelemetryReporter(PUBLIC_INSIGHTS_KEY);
    extensionContext.subscriptions.push(reporter);
  }
  return reporter;
}
