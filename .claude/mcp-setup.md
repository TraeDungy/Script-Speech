# Supabase MCP Integration Setup

This project has been configured to use the Supabase MCP (Model Context Protocol) server, which allows Claude Code to interact directly with your Supabase project.

## What is MCP?

MCP (Model Context Protocol) allows AI assistants like Claude to connect to external services and tools. The Supabase MCP server gives Claude direct access to:

- **Authentication**: Manage users, configure auth providers, view auth logs
- **Database**: Query tables, run SQL, manage schemas
- **Storage**: Upload/download files, manage buckets
- **Edge Functions**: Deploy and manage serverless functions
- **Realtime**: Configure realtime subscriptions

## Setup Instructions

### 1. Get Your Supabase Access Token

1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Name it "Claude Code MCP"
4. Copy the token

### 2. Set Environment Variable

Add your token to your environment:

```bash
# Add to ~/.zshrc or ~/.bashrc
export SUPABASE_ACCESS_TOKEN="your-token-here"

# Or set it for just this session
export SUPABASE_ACCESS_TOKEN="your-token-here"
```

### 3. Restart Claude Code

If you're using Claude Code CLI or VS Code extension, restart it to load the new MCP configuration.

### 4. Verify Connection

In Claude Code, you can now ask questions like:
- "Show me the authentication providers in Supabase"
- "Enable email authentication in Supabase"
- "What tables exist in the database?"
- "Run this SQL query in Supabase"

## Configuration File

The MCP configuration is stored in `.claude/mcp-config.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "params": {
        "project_ref": "xlbjhocngfmvswjpbbfj"
      },
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    }
  }
}
```

## Example Usage

Once set up, you can ask Claude Code to:

### Enable Email Authentication
```
Claude, enable email authentication in Supabase and configure magic link templates
```

### Query Database
```
Claude, show me all users in the auth.users table
```

### Manage Tables
```
Claude, create a new table called 'analytics' with columns for user_id, event_name, and timestamp
```

### View Configuration
```
Claude, what authentication providers are currently enabled?
```

## Troubleshooting

### "MCP server not found" error
- Make sure you've set the `SUPABASE_ACCESS_TOKEN` environment variable
- Restart Claude Code after setting the variable
- Check that the token has the correct permissions

### "Access denied" errors
- Verify your access token is correct
- Make sure the token hasn't expired
- Generate a new token if needed

### Connection issues
- Check your internet connection
- Verify the project ref is correct: `xlbjhocngfmvswjpbbfj`
- Try accessing https://mcp.supabase.com/mcp directly in a browser

## Security Notes

- ⚠️ Never commit `.env` files with your access token to git
- ⚠️ The access token grants full access to your Supabase project
- ⚠️ Keep your token secure and rotate it regularly
- ✅ Use environment variables for the token (already configured)
- ✅ Add `.claude/mcp-config.json` to `.gitignore` if it contains secrets (currently it uses env vars, so it's safe)

## Alternative: Manual Configuration

If MCP isn't available, you can still use the automation script:

```bash
export SUPABASE_ACCESS_TOKEN="your-token-here"
node scripts/configure-supabase-auth.js
```

## More Information

- Supabase MCP Documentation: https://supabase.com/docs/guides/ai/mcp
- Claude MCP Documentation: https://docs.anthropic.com/claude/docs/model-context-protocol
- Your Project Dashboard: https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj
