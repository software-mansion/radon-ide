import jwt from "jsonwebtoken";
import fs from "fs";

const publicKeyPath = process.argv[2];
const publicKey = fs.readFileSync(publicKeyPath);

const token = process.argv[3];

if (!token) {
  console.error("No token provided.");
  process.exit(2);
}

try {
  const payload = jwt.verify(token, publicKey);

  console.log(payload);
} catch (e) {
  console.error("Token expired or malformed.");
  process.exit(1);
}
