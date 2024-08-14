import jwt from "jsonwebtoken";
import fs from "fs";
import { exit } from "process";

// Returns the endsAt returned by the server if it is accessible
// or decodes the token locally and gets it from it.
async function getSubscriptionEndingDate(token, publicKey) {
  try {
    const response = await fetch(
      `http://localhost:3000/token/verify?token=${token}`
    );
    const result = await response.json();

    if (result.status !== "ok") {
      console.error("Token expired or malformed.");
      process.exit(1);
    }

    return result.endsAt;
  } catch {
    try {
      const payload = jwt.verify(token, publicKey);

      if (!payload.endsAt) {
        console.error("Token expired or malformed.");
        process.exit(1);
      }

      return payload.endsAt;
    } catch (e) {
      console.error("Token expired or malformed.");
      process.exit(1);
    }
  }
}

async function main() {
  const publicKeyPath = process.argv[2];
  const publicKey = fs.readFileSync(publicKeyPath);

  const token = process.argv[3];

  if (!token) {
    console.error("No token provided.");
    process.exit(1);
  }

  const endingDate = await getSubscriptionEndingDate(token, publicKey);

  if (new Date(endingDate).getTime() < new Date().getTime()) {
    console.error("License has ended.");
    exit(3);
  }

  console.log(endingDate);
}

main();
