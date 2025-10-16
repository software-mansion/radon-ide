# Radon MCP Proxy

A Model Context Protocol (MCP) server proxy that connects MCP clients to Radon IDE instances running in VS Code or Cursor.

## How it works

The proxy takes a workspace path as an argument and automatically locates the correct MCP server instance running in Radon IDE for that specific workspace. This enables MCP clients to interact with Radon IDE's React Native development tools and capabilities.

## Setup

### Prerequisites

- **Radon IDE extension** must be installed and running in VS Code or Cursor
- **React Native project** must be opened in VS Code/Cursor with Radon IDE active

### Automatic Setup (VS Code/Cursor)

**No manual installation required!** The Radon IDE extension automatically adds the MCP server configuration to your VS Code or Cursor MCP settings when you launch the Radon IDE panel in your React Native/Expo project workspace (unless explicitly configured not to do so).

### Manual Setup (Claude Code & Similar Tools)

For tools like Claude Code that don't read VS Code/Cursor MCP configurations, you need to manually add the server:

#### Claude Code Configuration

Add this server to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "radon": {
      "command": "npx",
      "args": ["radon-mcp", "/path/to/your/react-native/project"]
    }
  }
}
```

#### Other MCP-Compatible Tools

For other MCP-compatible tools, use the same configuration format as shown above, replacing the workspace path with your actual React Native project path.

## CLI Usage

For advanced users or debugging purposes, the proxy can be run directly from the command line:

```bash
npx radon-mcp <workspacePath>
```

Example:

```bash
npx radon-mcp /path/to/your/react-native/project
```
