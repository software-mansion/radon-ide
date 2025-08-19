import net from "node:net";

export async function checkPortOpen(host: string, port: number, timeout = 3000) {
  return new Promise((resolve, _) => {
    const socket = new net.Socket();

    const onError = (e: Error) => {
      socket.destroy();
      console.log(`Error: ${e.message}`);
      resolve(false);
    };

    socket.setTimeout(timeout);
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", onError);
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });

    socket.connect(port, host);
  });
}
