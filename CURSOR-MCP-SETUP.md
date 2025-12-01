# Cursor MCP Server Setup for Render

## Current Configuration

The Render MCP server configuration is stored in `.cursor-mcp-config.json` in your project root.

## How to Connect Cursor to Render MCP

### Option 1: Via Cursor Settings UI (Recommended)

1. **Open Cursor Settings:**
   - Press `Cmd + ,` (Mac) or `Ctrl + ,` (Windows/Linux)
   - Or go to: `Cursor` → `Settings` → `Features` → `Model Context Protocol`

2. **Add MCP Server:**
   - Click "Add MCP Server" or "Configure MCP Servers"
   - Add the following configuration:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer rnd_CSc513SWccTL7XnQBcMjFeRYjMyu"
      }
    }
  }
}
```

3. **Restart Cursor** for the changes to take effect

### Option 2: Via Settings JSON File

1. **Open Cursor Settings JSON:**
   - Press `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows/Linux)
   - Type: "Preferences: Open User Settings (JSON)"
   - Press Enter

2. **Add MCP Configuration:**
   Add this to your settings JSON:
   ```json
   {
     "mcp.servers": {
       "render": {
         "url": "https://mcp.render.com/mcp",
         "headers": {
           "Authorization": "Bearer rnd_CSc513SWccTL7XnQBcMjFeRYjMyu"
         }
       }
     }
   }
   ```

3. **Save and Restart Cursor**

### Option 3: Workspace-Specific Configuration

If you want this configuration only for the GodlyKidsGem2 workspace:

1. **Create `.vscode/settings.json`** in your project root:
   ```json
   {
     "mcp.servers": {
       "render": {
         "url": "https://mcp.render.com/mcp",
         "headers": {
           "Authorization": "Bearer rnd_CSc513SWccTL7XnQBcMjFeRYjMyu"
         }
       }
     }
   }
   ```

## Verify Connection

After setting up, you should be able to:
- See Render services in Cursor's MCP panel
- Query Render deployment status
- Access Render logs and build information
- Manage Render services through Cursor

## Troubleshooting

### MCP Server Not Connecting

1. **Check API Key:**
   - Verify the API key is correct: `rnd_CSc513SWccTL7XnQBcMjFeRYjMyu`
   - Ensure there are no extra spaces or characters

2. **Check Cursor Version:**
   - MCP support requires Cursor version with MCP features
   - Update Cursor to the latest version

3. **Check Network:**
   - Ensure you can access `https://mcp.render.com/mcp`
   - Check firewall/proxy settings

4. **Restart Cursor:**
   - Fully quit and restart Cursor after configuration changes

### View MCP Server Status

- Open Cursor's MCP panel (usually in the sidebar)
- Check for "render" server status
- Look for connection errors or warnings

## Current Configuration File

The configuration is also saved in `.cursor-mcp-config.json` in your project root for reference.


