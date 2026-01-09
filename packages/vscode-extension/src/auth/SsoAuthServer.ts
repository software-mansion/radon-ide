import { AddressInfo } from "node:net";
import http from "node:http";
import express from "express";
import { Disposable, env, Uri } from "vscode";
import { Logger } from "../Logger";
import { BASE_CUSTOMER_PORTAL_URL } from "../utilities/license";

const SSO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface SsoAuthResult {
  code: string;
}

export class SsoAuthServer implements Disposable {
  private expressServer: http.Server | null = null;
  private serverPort: Promise<number>;
  private resolveServerPort!: (port: number) => void;
  private callbackResolver: ((result: SsoAuthResult) => void) | null = null;
  private callbackRejecter: ((error: Error) => void) | null = null;

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

  private initializeHttpServer(): http.Server {
    const app = express();

    app.get("/auth/callback", (req: express.Request, res: express.Response) => {
      const code = req.query.code as string | undefined;

      if (!code) {
        res.redirect(new URL("/sso/failure", BASE_CUSTOMER_PORTAL_URL).toString());
        if (this.callbackRejecter) {
          this.callbackRejecter(new Error("Missing authorization code"));
        }
        return;
      }

      res.redirect(new URL("/sso/success", BASE_CUSTOMER_PORTAL_URL).toString());

      if (this.callbackResolver) {
        this.callbackResolver({ code });
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
  public async waitForCallback(): Promise<SsoAuthResult | null> {
    const callbackPromise = new Promise<SsoAuthResult>((resolve, reject) => {
      this.callbackResolver = resolve;
      this.callbackRejecter = reject;
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        Logger.info("[SSO] Auth server timed out after 5 minutes");
        resolve(null);
      }, SSO_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([callbackPromise, timeoutPromise]);
      return result;
    } finally {
      this.callbackResolver = null;
      this.callbackRejecter = null;
      this.dispose();
    }
  }
}

/**
 * Starts an SSO authentication flow.
 * Creates a temporary HTTP server to receive the callback, opens the SSO URL in the browser,
 * and waits for the callback or timeout.
 *
 * @returns The authorization code if successful, null if timed out or failed
 */
export async function startSsoAuthFlow(): Promise<SsoAuthResult | null> {
  const server = new SsoAuthServer();

  try {
    const port = await server.getPort();
    const redirectUri = `http://127.0.0.1:${port}/auth/callback`;
    const ssoUrl = new URL("/sso/authorize", BASE_CUSTOMER_PORTAL_URL);
    ssoUrl.searchParams.set("redirect_uri", redirectUri);

    Logger.info(`[SSO] Opening SSO URL: ${ssoUrl}`);

    // Open the SSO URL in the default browser
    await env.openExternal(Uri.parse(ssoUrl.toString()));

    // Wait for callback or timeout
    const result = await server.waitForCallback();

    return result;
  } catch (error) {
    Logger.error("[SSO] Error during SSO auth flow:", error);
    server.dispose();
    return null;
  }
}
