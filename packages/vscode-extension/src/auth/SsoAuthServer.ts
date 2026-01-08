import { AddressInfo } from "node:net";
import http from "node:http";
import express from "express";
import { Disposable, env, Uri } from "vscode";
import { Logger } from "../Logger";

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

    app.get("/callback", (req: express.Request, res: express.Response) => {
      const code = req.query.code as string | undefined;

      if (!code) {
        res.status(400).send(this.generateHtmlResponse("Error", "Missing authorization code."));
        if (this.callbackRejecter) {
          this.callbackRejecter(new Error("Missing authorization code"));
        }
        return;
      }

      res
        .status(200)
        .send(
          this.generateHtmlResponse(
            "Success",
            "Authorization successful! You can close this window."
          )
        );

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
   * Wait for a callback with a code parameter.
   * Uses Promise.race to implement a timeout.
   * @returns The authorization code from the callback, or null if timed out
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

  private generateHtmlResponse(title: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - Radon IDE</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #1e1e1e;
              color: #ffffff;
            }
            .container {
              text-align: center;
              padding: 40px;
              background-color: #252526;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            }
            h1 {
              margin-bottom: 16px;
              color: ${title === "Success" ? "#4ec9b0" : "#f48771"};
            }
            p {
              color: #cccccc;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${title}</h1>
            <p>${message}</p>
          </div>
        </body>
      </html>
    `;
  }
}

/**
 * Starts an SSO authentication flow.
 * Creates a temporary HTTP server to receive the callback, opens the SSO URL in the browser,
 * and waits for the callback or timeout.
 *
 * @param ssoBaseUrl - The base URL for the SSO provider
 * @returns The authorization code if successful, null if timed out or failed
 */
export async function startSsoAuthFlow(ssoBaseUrl: string): Promise<SsoAuthResult | null> {
  const server = new SsoAuthServer();

  try {
    const port = await server.getPort();
    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const ssoUrl = `${ssoBaseUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`;

    Logger.info(`[SSO] Opening SSO URL: ${ssoUrl}`);

    // Open the SSO URL in the default browser
    await env.openExternal(Uri.parse(ssoUrl));

    // Wait for callback or timeout
    const result = await server.waitForCallback();

    return result;
  } catch (error) {
    Logger.error("[SSO] Error during SSO auth flow:", error);
    server.dispose();
    return null;
  }
}
