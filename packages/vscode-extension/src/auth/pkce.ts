import crypto from "node:crypto";

/**
 * Generates a cryptographically random code verifier for PKCE.
 * The verifier is a 32-byte random string, base64url encoded.
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generates a code challenge from the code verifier using SHA256.
 * The challenge is the SHA256 hash of the verifier, base64url encoded.
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}
