const CDP = require("chrome-remote-interface");

async function connectAndEvaluate() {
  let client;
  try {
    // Connect to the remote VM
    client = await CDP({ port: 8081, local: true });

    // Extract required domains
    const { Runtime, Debugger } = client;

    // Compile and execute some JS in the remote VM
    Runtime.enable();
    Debugger.enable({ maxScriptsCacheSize: 100000000 });
    Runtime.runIfWaitingForDebugger();
    const codez = `
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    console.log("agent", !!hook.reactDevtoolsAgent);`;
    const result = await Runtime.evaluate({ expression: codez });
    console.log(result.result.value); // should output: 4
  } catch (error) {
    console.error("Error connecting to remote VM:", error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

connectAndEvaluate();
