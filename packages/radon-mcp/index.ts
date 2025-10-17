#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join, resolve, normalize } from 'path';
import { homedir } from 'os';

const RETRY_DELAY_MS = 5000;

interface RadonConfig {
  mcpServerUrl: string;
  workspaceFolder: string;
}

function normalizeWorkspacePath(workspacePath: string): string {
  return normalize(resolve(workspacePath));
}

function getWorkspaceConfig(normalizedPath: string): string {
  const hash = createHash('md5').update(normalizedPath).digest('hex');
  const configPath = join(
    homedir(),
    'Library',
    'Caches',
    'com.swmansion.radon-ide',
    'Mcp',
    `radon-mcp-${hash}.json`
  );

  try {
    const configContent = readFileSync(configPath, 'utf8');
    const config: RadonConfig = JSON.parse(configContent);

    if (!config.mcpServerUrl) {
      throw new Error('mcpServerUrl not found in config file');
    }

    if (config.workspaceFolder !== normalizedPath) {
      throw new Error(
        `Workspace folder mismatch: expected ${normalizedPath}, got ${config.workspaceFolder}`
      );
    }

    return config.mcpServerUrl;
  } catch (error) {
    throw new Error(`Failed to read Radon config from ${configPath}: ${error}`);
  }
}

class MCPProxyServer {
  private server: Server;
  private httpClient: Client | null = null;
  private httpTransport: StreamableHTTPClientTransport | null = null;
  private isConnecting: boolean = false;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private normalizedPath: string;

  constructor(normalizedPath: string) {
    this.normalizedPath = normalizedPath;

    // Create MCP server for stdio transport
    this.server = new Server(
      {
        name: 'radon-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async isConnectionLost(): Promise<boolean> {
    if (!this.httpClient) {
      return true;
    }

    try {
      await this.httpClient.ping();
      return false; // Connection is still alive
    } catch (error) {
      console.error('Ping failed, connection is lost:', error);
      return true; // Connection is lost
    }
  }

  private async checkAndHandleConnectionLoss(): Promise<void> {
    if (await this.isConnectionLost()) {
      if (this.isConnecting) {
        return;
      }

      this.isConnecting = true;

      console.error('Connection lost. Attempting to reconnect...');
      await this.disconnect();
      this.server.sendToolListChanged();
      this.attemptConnection();
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.httpClient) {
        return { tools: [] };
      }

      try {
        return await this.httpClient.listTools();
      } catch (error) {
        console.error('Failed to list tools:', error);
        this.checkAndHandleConnectionLoss();
        return { tools: [] };
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.httpClient) {
        throw new Error('Not connected to HTTP server');
      }

      try {
        return await this.httpClient.callTool({
          name: request.params.name,
          arguments: request.params.arguments,
        });
      } catch (error) {
        console.error('Failed to call tool:', error);
        this.checkAndHandleConnectionLoss();
        throw error;
      }
    });
  }

  private async attemptConnection() {
    try {
      const httpServerUrl = getWorkspaceConfig(this.normalizedPath);
      console.error(`✓ Config file found: ${httpServerUrl}`);

      this.httpClient = new Client({
        name: 'radon-mcp-client',
        version: '1.0.0',
      });

      this.httpTransport = new StreamableHTTPClientTransport(
        new URL(httpServerUrl)
      );
      await this.httpClient.connect(this.httpTransport);

      this.isConnecting = false;

      console.error(`✓ Server connection successful: ${httpServerUrl}`);
      this.server.sendToolListChanged();
    } catch (error) {
      console.error(`✗ Connection attempt failed: ${error}`);
      console.error('Retrying in 5 seconds...');
      setTimeout(() => this.attemptConnection(), RETRY_DELAY_MS);
    }
  }

  private async disconnect() {
    await this.httpTransport?.close().catch(() => {});
    await this.httpClient?.close().catch(() => {});
    this.httpClient = null;
    this.httpTransport = null;
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Proxy Server started successfully');

    this.isConnecting = true;
    this.attemptConnection();
  }
}

async function main() {
  try {
    const workspacePath = process.argv[2] || process.cwd();
    const normalizedPath = normalizeWorkspacePath(workspacePath);

    console.error(`Using workspace: ${normalizedPath}`);
    console.error('Starting MCP Proxy Server...');

    const proxyServer = new MCPProxyServer(normalizedPath);
    await proxyServer.start();
  } catch (error) {
    console.error('Failed to start MCP proxy server:', error);
    process.exit(1);
  }
}

main();
