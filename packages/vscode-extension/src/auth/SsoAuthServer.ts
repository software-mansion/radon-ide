import { AddressInfo } from "node:net";
import http from "node:http";
import express from "express";
import { Disposable, env, Uri } from "vscode";
import { Logger } from "../Logger";
import { BASE_CUSTOMER_PORTAL_URL } from "../utilities/license";
import { generatePKCE } from "./pkce";

const SSO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface SsoCallbackResult {
  code: string;
}

export interface SsoAuthResult {
  code: string;
  codeVerifier: string;
}

export class SsoAuthServer implements Disposable {
  private expressServer: http.Server | null = null;
  private serverPort: Promise<number>;
  private resolveServerPort!: (port: number) => void;
  private callbackResolve: ((result: SsoCallbackResult) => void) | null = null;
  private callbackReject: ((error: Error) => void) | null = null;
  private expectedState: string | null = null;

  constructor() {
    const { promise, resolve } = Promise.withResolvers<number>();
    this.serverPort = promise;
    this.resolveServerPort = resolve;

    this.expressServer = this.initializeHttpServer();
  }

  public dispose() {
    if (this.expressServer) {
      this.expressServer.closeAllConnections();
      this.expressServer.close();
      this.expressServer = null;
    }
  }

  public async getPort(): Promise<number> {
    return this.serverPort;
  }

  public setExpectedState(state: string): void {
    this.expectedState = state;
  }

  private initializeHttpServer(): http.Server {
    const app = express();

    app.get("/auth/callback", (req: express.Request, res: express.Response) => {
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;

      if (!code || !state) {
        res.redirect(new URL("/sso/failure", BASE_CUSTOMER_PORTAL_URL).toString());
        if (this.callbackReject) {
          this.callbackReject(new Error("Missing authorization code or state"));
        }
        return;
      }

      if (state !== this.expectedState) {
        res.redirect(new URL("/sso/failure", BASE_CUSTOMER_PORTAL_URL).toString());
        if (this.callbackReject) {
          this.callbackReject(new Error("State mismatch - potential CSRF attack"));
        }
        return;
      }

      res.redirect(new URL("/sso/success", BASE_CUSTOMER_PORTAL_URL).toString());

      if (this.callbackResolve) {
        this.callbackResolve({ code });
      }
    });

    return app.listen(0, "127.0.0.1").on("listening", () => {
      const addressInfo = this.expressServer?.address() as AddressInfo;
      this.resolveServerPort(addressInfo.port);
      Logger.info(`[SSO] Started SSO auth server on port ${addressInfo.port}`);
    });
  }

  /**
   * @returns The authorization code from the callback, or null if timed out after 5 minutes
   */
  public async waitForAuthorizationCode(): Promise<SsoCallbackResult | null> {
    const callback = new Promise<SsoCallbackResult>((resolve, reject) => {
      this.callbackResolve = resolve;
      this.callbackReject = reject;
    });

    // Timeout after 5 minutes
    let timeoutId: NodeJS.Timeout;
    const timeout = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        Logger.info("[SSO] Auth server timed out after 5 minutes");
        resolve(null);
      }, SSO_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([callback, timeout]);
      return result;
    } finally {
      this.callbackResolve = null;
      this.callbackReject = null;
      clearTimeout(timeoutId!);
      this.dispose();
    }
  }
}

/**
 * Starts an SSO authentication flow with PKCE.
 * Creates a temporary HTTP server to receive the callback, opens the SSO URL in the browser,
 * and waits for the callback or timeout.
 *
 * @returns The authorization code and code verifier if successful, null if timed out or failed
 */
export async function startSsoAuthFlow(): Promise<SsoAuthResult | null> {
  const server = new SsoAuthServer();

  try {
    const port = await server.getPort();

    const { codeVerifier, codeChallenge, state } = generatePKCE();
    server.setExpectedState(state);

    const ssoAuthUrl = buildSsoAuthorizationUrl(port, codeChallenge, state);

    // Open the SSO URL in the default browser
    Logger.info(`[SSO] Opening SSO URL: ${ssoAuthUrl}`);
    await env.openExternal(Uri.parse(ssoAuthUrl));

    // Wait for callback or timeout
    const result = await server.waitForAuthorizationCode();

    if (result) {
      return { ...result, codeVerifier };
    }
    return null;
  } catch (error) {
    Logger.error("[SSO] Error during SSO auth flow:", error);
    server.dispose();
    return null;
  }
}

function buildSsoAuthorizationUrl(port: number, codeChallenge: string, state: string): string {
  const redirectUri = `http://127.0.0.1:${port}/auth/callback`;

  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: state,
  });
  const ssoUrl = new URL(`/sso/authorize?${params}`, BASE_CUSTOMER_PORTAL_URL);

  return ssoUrl.toString();
}
