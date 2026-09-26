---
title: "SSTI to RCE via Unsandboxed Jinja2 in IBM's MCP Context Forge"
date: 2026-08-22
author: "Yuval Elbar"
tags: ["ssti", "rce", "jinja2", "ibm"]
---

**IBM · High (8.8) · CWE-94 + CWE-1336 · Fixed in 1.0.0**

> **TL;DR** — IBM's MCP Context Forge gateway rendered user-controlled prompt templates through a plain `jinja2.Environment()` instead of a `SandboxedEnvironment`. An authenticated user with prompt permissions could store a template that traverses to `__builtins__.__import__` and runs OS commands — Server-Side Template Injection to RCE on the gateway host.

## What is SSTI?

Template engines like Jinja2 are designed to evaluate expressions. If an attacker controls the *template string* (not just the data passed into it), they don't just inject text — they inject code that the engine happily evaluates. In Python/Jinja2, the canonical escalation walks the object graph from an innocent value up to Python builtins:

```python
{{ ''.__class__.__mro__[1].__subclasses__() }}
```

From there you reach `__builtins__.__import__('os')` and execute commands. The defense Jinja2 ships for exactly this is `SandboxedEnvironment`, which blocks access to unsafe attributes during rendering. The bug here is using the *unsandboxed* environment on untrusted templates.

## Root cause

`PromptService._render_template()` used the unsandboxed environment:

```python
from jinja2 import Environment          # unsandboxed
env = Environment()
env.from_string(user_template).render(**context)
```

instead of the safe one:

```python
from jinja2.sandbox import SandboxedEnvironment
env = SandboxedEnvironment()
```

The templates rendered by this method are user-supplied prompt templates stored in the database — so the "template string" is attacker-controllable, which is precisely the condition SSTI needs.

## Attack path

The vulnerable data flow runs through the prompt API:

```text
POST /prompts            -> persist attacker-controlled template content
PUT  /prompts/{id}       -> (same)
(bulk register)          -> (same)
        |
        v
get_prompt() -> PromptService._render_template()  -> RCE
```

An authenticated user with prompt registration/update permission stores a malicious Jinja2 template; when it's later rendered, arbitrary commands run with the gateway process's privileges via `os.popen()`-style chains.

## Impact

- Arbitrary command execution on the gateway host.
- Filesystem read/write, environment-variable and secret exposure.
- Network access for lateral movement; persistence via additional malicious prompts.

The blast radius is worst in the environments MCP gateways are built for: **multi-tenant gateways** (one compromised tenant can reach the shared host) and **CI/CD pipelines** that sync prompts from untrusted sources. All PyPI deployments on `0.9.0` or earlier (`mcp-contextforge-gateway < 1.0.0`) were affected.

## The fix

Version 1.0.0 migrates prompt rendering to `SandboxedEnvironment`, which forbids the unsafe attribute traversal (`__class__`, `__mro__`, `__subclasses__`, `__globals__`, …) that SSTI-to-RCE depends on.

> **Rule for template engines.** If a template string can come from a user, render it in a sandbox — or better, don't let users control template *syntax* at all; give them data slots, not a templating language. Passing untrusted input as *values* is fine; passing it as the *template* is code execution.

## Why this matters for MCP

MCP gateways sit between models and tools, and "prompts" feel like data. But a prompt *template* is code the moment it's rendered by a real engine. As the MCP ecosystem grows, expect classic server-side bug classes (SSTI, SSRF, injection) to keep resurfacing in components that were reasoned about as "just prompts" or "just config."

## Disclosure

Reported through GitHub Security Advisories; fixed in 1.0.0.

## References

- [GHSA-vwf3-4xxj-qg6h (advisory)](https://github.com/IBM/mcp-context-forge/security/advisories/GHSA-vwf3-4xxj-qg6h)
- [CWE-94: Code Injection (MITRE)](https://cwe.mitre.org/data/definitions/94.html)
- [CWE-1336: Template Engine Injection](https://cwe.mitre.org/data/definitions/1336.html)
- [Jinja2 sandbox docs](https://jinja.palletsprojects.com/en/latest/sandbox/)
