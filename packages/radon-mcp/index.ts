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

interface RadonConfig {
  mcpServerUrl: string;
}

function normalizeWorkspacePath(workspacePath: string): string {
  // Resolve the path to get absolute path and normalize separators
  const resolvedPath = resolve(workspacePath);

  // Normalize the path (removes redundant separators, resolves . and ..)
  const normalizedPath = normalize(resolvedPath);

  // Remove trailing slash if present (except for root directory)
  return normalizedPath.replace(/\/$/, '') || '/';
}

function getWorkspaceConfig(normalizedPath: string): string {
  // Generate MD5 hash of the normalized workspace path
  const hash = createHash('md5').update(normalizedPath).digest('hex');

  // Construct the config file path
  const configPath = join(
    homedir(),
    'Library',
    'Caches',
    'com.swmansion.radon-ide',
    `radon-mcp-${hash}.json`
  );

  try {
    const configContent = readFileSync(configPath, 'utf8');
    const config: RadonConfig = JSON.parse(configContent);

    if (!config.mcpServerUrl) {
      throw new Error('mcpServerUrl not found in config file');
    }

    return config.mcpServerUrl;
  } catch (error) {
    throw new Error(`Failed to read Radon config from ${configPath}: ${error}`);
  }
}

async function waitForConfigAndConnection(
  normalizedPath: string
): Promise<{ httpServerUrl: string; httpClient: Client }> {
  while (true) {
    let httpServerUrl: string;

    try {
      // Always read the config file fresh on each attempt
      httpServerUrl = getWorkspaceConfig(normalizedPath);
      console.error(`✓ Config file found: ${httpServerUrl}`);
    } catch (error) {
      console.error(`✗ Config file missing or invalid: ${error}`);
      console.error('Retrying in 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    try {
      // Create the actual client that will be used for proxying
      const httpClient = new Client({
        name: 'radon-mcp-client',
        version: '1.0.0',
      });

      // Test the connection with the actual client
      const transport = new StreamableHTTPClientTransport(
        new URL(httpServerUrl)
      );
      await httpClient.connect(transport);

      // If we get here, both config and connection are successful
      console.error(`✓ Server connection successful: ${httpServerUrl}`);
      return { httpServerUrl, httpClient };
    } catch (error) {
      console.error(`✗ Server connection failed: ${error}`);
      console.error('Retrying in 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

class MCPProxyServer {
  private server: Server;
  private httpClient: Client;
  private httpServerUrl: string;
  private isConnected: boolean = false;
  private abortController: AbortController | null = null;

  constructor(httpServerUrl: string, httpClient: Client) {
    this.httpServerUrl = httpServerUrl;
    this.httpClient = httpClient;
    this.isConnected = true; // Client is already connected

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

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        if (!this.isConnected) {
          throw new Error('Not connected to HTTP server');
        }
        return await this.httpClient.listTools();
      } catch (error) {
        console.error('Failed to list tools:', error);
        throw error;
      }
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (!this.isConnected) {
          throw new Error('Not connected to HTTP server');
        }
        return await this.httpClient.callTool({
          name: request.params.name,
          arguments: request.params.arguments,
        });
      } catch (error) {
        console.error('Failed to call tool:', error);
        throw error;
      }
    });
  }

  async start() {
    // Client is already connected from waitForConfigAndConnection
    // Set up connection monitoring
    this.abortController = new AbortController();

    // Monitor connection health periodically
    const healthCheckInterval = setInterval(async () => {
      try {
        // Try to list tools to check if connection is still alive
        await this.httpClient.listTools();
      } catch (error) {
        console.error('Connection lost. Shutting down...');
        clearInterval(healthCheckInterval);
        this.abortController?.abort();
        process.exit(1);
      }
    }, 10000); // Check every 10 seconds

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.error('Received SIGINT. Shutting down...');
      clearInterval(healthCheckInterval);
      this.abortController?.abort();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Received SIGTERM. Shutting down...');
      clearInterval(healthCheckInterval);
      this.abortController?.abort();
      process.exit(0);
    });

    // Start the MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Proxy Server started successfully');
  }
}

async function main() {
  try {
    // Get workspace path from command line arguments
    const workspacePath = process.argv[2];

    if (!workspacePath) {
      console.error('Usage: radon-mcp <workspacePath>');
      console.error('Example: radon-mcp /path/to/your/react-native/project');
      process.exit(1);
    }

    // Normalize the workspace path once
    const normalizedPath = normalizeWorkspacePath(workspacePath);

    console.error(`Using workspace: ${normalizedPath}`);
    console.error('Waiting for Radon AI to be ready...');

    // Wait for config file and connection with retries
    const { httpServerUrl, httpClient } = await waitForConfigAndConnection(
      normalizedPath
    );

    const proxyServer = new MCPProxyServer(httpServerUrl, httpClient);
    await proxyServer.start();
  } catch (error) {
    console.error('Failed to start MCP proxy server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
