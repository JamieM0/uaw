# WorkSpec Studio Agent bridge

WorkSpec Studio remains a static web application. This optional localhost service gives its Agent drawer access to programmatic Codex threads without placing credentials or a server-side SDK in browser code.

## Start

```bash
cd web/agent-bridge
npm install
npm start
```

The bridge listens on `http://127.0.0.1:4317`. Change the port with `UAW_AGENT_PORT` or configure a different address in WorkSpec Studio → Settings → Codex Agent.

## Behaviour

- Receives the current browser project as a snapshot.
- Uses `@openai/codex-sdk` from a local Node.js process.
- Gives Codex a project workspace containing the WorkSpec schema, package reference and a canonical `validate-workspec.cjs` tool.
- Keeps the current WorkSpec immutable and asks Codex to write proposed edits to a separate file.
- Validates proposals with `packages/workspec/workspec-validator.js`.
- Returns the proposal to the browser for Monaco diff review. Nothing is applied automatically.

Codex authentication and configuration are inherited from the local Codex installation. The bridge does not accept remote origins by default. Additional exact origins can be supplied as a comma-separated `UAW_AGENT_ALLOWED_ORIGINS` value.
