---
title: "SSTI to RCE via Unsandboxed Jinja2 in IBM's MCP Context Forge"
date: 2026-08-22
author: "Yuval Elbar"
tags: ["ssti", "rce", "jinja2", "ibm"]
---

**IBM — mcp-context-forge · High (8.8) · CWE-94 + CWE-1336 · Fixed in 1.0.0**

The gateway rendered user-supplied prompt templates in a plain `jinja2.Environment()` instead of a `SandboxedEnvironment`. A stored template could walk up to Python builtins and run OS commands — server-side template injection to remote code execution on the gateway host.

## SSTI in one paragraph

Jinja2 evaluates expressions. If the attacker controls the *template string* (not just the data), they can inject code. The standard escalation walks the object graph to builtins — `{{ ''.__class__.__mro__[1].__subclasses__() }}` and onward to `__import__('os')`. Jinja2 ships `SandboxedEnvironment` to block exactly this; the bug was using the unsandboxed one on untrusted templates.

## Root cause

```python
from jinja2 import Environment          # unsandboxed
env = Environment()
env.from_string(user_template).render(**context)
```

The templates passed here are user-supplied prompts stored in the database, so `user_template` is attacker-controlled — the one condition SSTI needs. The path runs `POST /prompts` / `PUT /prompts/{id}` → `get_prompt()` → `_render_template()`, and an authenticated user with prompt permissions can store a payload that executes on render with the gateway's privileges.

## Impact

Command execution on the gateway host, filesystem and secret access, lateral movement. Worst for the setups MCP gateways target: multi-tenant deployments (one tenant reaches the shared host) and CI/CD that syncs prompts from untrusted sources. Everything on `mcp-contextforge-gateway < 1.0.0` was affected.

## The fix

1.0.0 switches to `SandboxedEnvironment`, which blocks the attribute traversal (`__class__`, `__mro__`, `__globals__`, …) SSTI-to-RCE relies on. If users can supply a template string, render it sandboxed — or don't give them a template language at all, just data slots.

## Disclosure

Reported through GitHub Security Advisories; fixed in 1.0.0.

## References

- [GHSA-vwf3-4xxj-qg6h](https://github.com/IBM/mcp-context-forge/security/advisories/GHSA-vwf3-4xxj-qg6h)
- [CWE-94](https://cwe.mitre.org/data/definitions/94.html) · [CWE-1336](https://cwe.mitre.org/data/definitions/1336.html) · [Jinja2 sandbox](https://jinja.palletsprojects.com/en/latest/sandbox/)
