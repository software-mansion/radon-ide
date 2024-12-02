import TelemetryReporter from "@vscode/extension-telemetry";
import { extensionContext } from "./extensionContext";

const PUBLIC_APP_INSIGHTS_CONNECTION_STRING =
  "InstrumentationKey=6709dbd6-92e7-40f6-be09-618db8a85ce9";

let reporter: TelemetryReporter | undefined;

export function getTelemetryReporter(): TelemetryReporter {
  if (!reporter) {
    reporter = new TelemetryReporter(PUBLIC_APP_INSIGHTS_CONNECTION_STRING);
    extensionContext.subscriptions.push(reporter);
  }
  return reporter;
}
