---
title: "Case-Variant Tool Names Bypass Reserved-Name Checks in Docker MCP Gateway"
date: 2026-10-13
author: "Yuval Elbar"
tags: ["mcp", "case-sensitivity", "tool-spoofing", "docker"]
---

**Docker — mcp-gateway · Moderate (6.3) · CWE-178 · Fixed in v0.44.1**

The gateway checked for reserved tool-name collisions case-sensitively but matched the allowlist case-insensitively. A case variant of a built-in tool slips past the collision guard and registers next to the real one — so a client's arguments, meant for a built-in control-plane tool, can be routed to an untrusted MCP server.

## Root cause

Two code paths disagreed on case. `validateToolNameCollisions` compared reserved, newly-seen, and registered tool names using case-sensitive map keys. `isToolEnabled` matched allowlist entries case-insensitively (CWE-178). So a name like `MCP-Exec` is "different" to the collision check but "the same" to the enable check: it passes the guard that's supposed to reserve `mcp-exec`, and then it's treated as enabled.

## Exploitation

It needs two conditions: an operator has enabled an attacker-controlled MCP server, and a connected client selects the look-alike tool. When that happens, the client sends arguments it believes are going to a built-in gateway control-plane tool, and they reach the untrusted server instead. Affected `v0.43.1`–`v0.43.3`.

## The fix

v0.44.1 makes collision detection case-insensitive and allowlist matching exact-case, so the two paths agree. Deployments that enable tool-name prefixing were never affected (and that's also the workaround for anyone who can't upgrade immediately).

## Disclosure

Reported through GitHub Security Advisories, via Cycode; fixed in v0.44.1.

## References

- [GHSA-qg99-jrvf-j9fh](https://github.com/docker/mcp-gateway/security/advisories/GHSA-qg99-jrvf-j9fh)
- [CWE-178](https://cwe.mitre.org/data/definitions/178.html)
