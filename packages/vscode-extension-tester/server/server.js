import { fileURLToPath } from "url";
import path from "path";
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import multer from "multer";
import compression from "compression";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

const filePath = join(
  process.cwd(),
  "files_for_tests/data_for_network_tests.json"
);
const fileContent = readFileSync(filePath, "utf-8");
const data = JSON.parse(fileContent);

app.use(express.static("."));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/get", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(data["api/get"].response.body);
});

app.post("/api/post", (req, res) => {
  res.status(201).json(data["api/post"].response.body);
});

app.patch("/api/patch/:id", (req, res) => {
  res.status(204).send();
});

app.put("/api/put/:id", (req, res) => {
  res.status(200).json(data["api/put/2"].response.body);
});

app.delete("/api/delete/:id", (req, res) => {
  res.json(data["api/delete/1"].response.body);
});

app.post("/api/multipart", upload.single("multipart_data"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  res.json(data["api/multipart"].response.body);
});

app.post("/api/form", (req, res) => {
  res.json(data["api/form"].response.body);
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

app.post("/api/query-and-body", (req, res) => {
  res.json(data["api/query-and-body"].response.body);
});

app.get("/api/redirect", (req, res) => {
  res.redirect(301, "/api/get?redirected=true");
});

app.get("/api/error/client-error", (req, res) => {
  res.status(403).json(data["api/error/client-error"].response.body);
});

app.get("/api/error/server-error", (req, res) => {
  res.status(503).send(data["api/error/server-error"].response.body);
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

app.get("/api/large-body", (req, res) => {
  const targetSizeMB = 5;
  const dummyString = "X ".repeat(1024);
  const iterations = targetSizeMB * 512;

  const largeData = [];
  for (let i = 0; i < iterations; i++) {
    largeData.push(dummyString);
  }
  res.send(largeData.join(""));
});

app.get("/api/delay", (req, res) => {
  const delay = 3000;

  setTimeout(() => {
    res.json(data["api/delay"].response.body);
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
