import crypto from "node:crypto";

// https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce#how-it-works

interface PKCE {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

export function generatePKCE(): PKCE {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  // for CSRF protection
  const state = crypto.randomBytes(16).toString("base64url");

  return { codeVerifier, codeChallenge, state };
}
