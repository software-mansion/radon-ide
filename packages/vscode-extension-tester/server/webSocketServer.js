import { fileURLToPath } from "url";
import http from "http";
import path from "path";
import express from "express";
import multer from "multer";
import compression from "compression";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let server = null;
let wss = null;
let appWebsocket = null;

app.use(express.static("."));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/get", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json({
    meta: {
      page: "2",
      sort: "desc",
      total: 2,
    },
    data: [
      { id: 1, name: "John Doe", email: "john@example.com" },
      { id: 2, name: "Jane Doe", email: "jane@example.com" },
    ],
  });
});

app.post("/api/post", (req, res) => {
  res.status(201).json({
    message: "Post request successful",
    userId: 3,
    captured_data: req.body,
  });
});

app.post("/api/query-and-body", (req, res) => {
  const { type, source } = req.query;
  const { payload, extra } = req.body;
  res.json({
    received_query: { type, source },
    received_body: { payload, extra },
    message: "Query params and body received successfully",
  });
});

app.patch("/api/patch/:id", (req, res) => {
  res.status(204).send();
});

app.put("/api/put/:id", (req, res) => {
  const id = parseInt(req.params.id);
  res.status(200).json({
    message: "Put request successful",
    user: {
      id: id,
      ...req.body,
    },
  });
});

app.delete("/api/delete/:id", (req, res) => {
  const id = parseInt(req.params.id);
  res.json({
    message: "Delete request successful",
    deletedId: id,
  });
});

app.post("/api/multipart", upload.single("multipart_data"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  const description = req.body.description;
  console.log("MULTIPART RECEIVED");

  res.json({
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    metadata_received: description,
  });
});

app.post("/api/form", (req, res) => {
  const { username } = req.body;
  console.log(req.body);
  res.json({
    type: "Legacy Form",
    received_user: username,
    login_status: "active",
  });
});

app.get("/api/binary", (req, res) => {
  const buffer = Buffer.alloc(128);
  for (let i = 0; i < 128; i++) {
    buffer[i] = Math.floor(Math.abs(Math.sin(i + 12345)) * 256);
  }
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(buffer);
});

app.get("/api/compress", compression(), (req, res) => {
  const largeDataSet = [];
  for (let i = 0; i < 1000; i++) {
    largeDataSet.push({ id: i, text: "Repeating string to compress " + i });
  }
  res.json(largeDataSet);
});

app.get("/api/redirect", (req, res) => {
  res.redirect(301, "/api/get?redirected=true");
});

app.get("/api/error/client-error", (req, res) => {
  res.status(403).json({
    error: "Forbidden",
    message: "Invalid Token provided",
    code: 403,
  });
});

app.get("/api/error/server-error", (req, res) => {
  res.status(503).send(`
        <html>
            <body>
                <h1>503 Service Unavailable</h1>
                <p>The upstream server is currently unavailable.</p>
                <hr>
                <address>Nginx/1.18.0</address>
            </body>
        </html>
    `);
});

app.get("/api/stream-xhr", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");

  res.write("--- Stream Started ---\n");

  let chunkCount = 0;
  const maxChunks = 5;

  const interval = setInterval(() => {
    chunkCount++;
    res.write(`[Chunk ${chunkCount}] Data received\n`);

    if (chunkCount >= maxChunks) {
      clearInterval(interval);
      res.write("--- Stream Finished ---");
      res.end();
    }
  }, 1000);
});

app.get("/api/error/truncated", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": "1024",
  });
  res.write(
    '{ "message": "This is the start of a valid JSON object, but it will die soon..."'
  );
  setTimeout(() => {
    console.log("error: Destroying socket for /truncated");
    req.socket.destroy();
  }, 100);
});

app.get("/api/error/hang", (req, res) => {
  console.log("error: Hanging connection intentionally (Zombie Request)...");
});

app.get("/api/large-body", (req, res) => {
  console.log("START");
  const targetSizeMB = 5;
  const dummyString = "X ".repeat(1024);
  const iterations = targetSizeMB * 512;

  const largeData = [];
  for (let i = 0; i < iterations; i++) {
    largeData.push(dummyString);
  }
  res.send(largeData.join(""));
  console.log("END");
});

app.get("/api/delay", (req, res) => {
  const delay = 3000;
  console.log(`Delay: Holding request for ${delay}ms...`);

  setTimeout(() => {
    res.json({
      message: "Response received after delay",
      delay_ms: delay,
    });
  }, delay);
});

app.get("/api/image", (req, res) => {
  res.sendFile(path.join(__dirname, "img", "img.jpg"));
});

app.get("/api/large-image", (req, res) => {
  res.sendFile(path.join(__dirname, "img", "large_img.jpg"));
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found", endpoint: req.originalUrl });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

export function resetAppWebsocket() {
  appWebsocket = null;
}

export function getAppWebsocket() {
  return appWebsocket;
}

export function waitForMessage(id, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const currentWs = getAppWebsocket();
    if (!currentWs) {
      reject(new Error("No websocket connection"));
      return;
    }

    const timer = setTimeout(() => {
      currentWs.off("message", handler);
      reject(new Error("Timeout waiting for message"));
    }, timeoutMs);

    const handler = (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.id === id) {
          clearTimeout(timer);
          currentWs.off("message", handler);
          resolve(msg);
        }
      } catch (e) {}
    };

    currentWs.on("message", handler);
  });
}

export function closeServer() {
  if (wss) {
    wss.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {}
    });

    wss.close(() => {
      console.log("WebSocket server closed");
    });
    wss = null;
    appWebsocket = null;
  }

  if (server) {
    server.close(() => {
      console.log("HTTP server closed");
    });
    server = null;
  }
}

export function initServer(port = 8080) {
  if (wss) {
    console.warn("WebSocket server already initialized");
    return;
  }

  server = http.createServer(app);
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    appWebsocket = ws;
    console.log("WS: Client connected");

    ws.send(
      JSON.stringify({ type: "WELCOME", message: "Connected to Live Ticker" })
    );

    ws.on("message", (message) => {
      const msgStr = message.toString();
      try {
        const msg = JSON.parse(msgStr);
        console.log("Received message:", msg);
      } catch (e) {
        console.log("Received raw message:", msgStr);
      }

      ws.send(JSON.stringify({ type: "ECHO", content: msgStr }));
    });

    ws.on("close", () => {
      if (appWebsocket === ws) appWebsocket = null;
      console.log("Client disconnected");
    });
  });

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`WebSocket server listening on ws://localhost:${port}`);
  });

  return wss;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initServer(8080);
}
