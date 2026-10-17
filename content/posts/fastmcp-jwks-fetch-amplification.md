---
title: "Unknown JWT Key IDs Amplify Traffic to the IdP in FastMCP's JWTVerifier"
date: 2026-10-16
author: "Yuval Elbar"
tags: ["dos", "jwt", "jwks", "mcp", "python"]
---

**PrefectHQ — fastmcp · High · CWE-400 + CWE-770 · Fixed in 3.4.9 and 4.1.0**

FastMCP's `JWTVerifier` fetched the identity provider's JWKS on every unknown key ID, with no negative caching and no lock. An attacker sending unsigned tokens with random `kid` values turns one request into one outbound fetch to the IdP — amplified, unauthenticated traffic that can get the IdP to rate-limit you and break auth for everyone.

## Root cause

In `JWTVerifier._get_jwks_key` (around `jwt.py:345`), the cached JWKS is only consulted for key IDs it already knows. On a miss it refetches the entire JWKS from the IdP — every time. Three things make that abusable:

- Misses aren't cached, so the same unknown `kid` refetches forever.
- There's no cooldown or lock, so concurrent misses fan out into concurrent fetches.
- Key resolution happens *before* signature verification, so a request only needs a parseable JWT header to trigger a fetch. The token doesn't have to be valid or signed.

## Exploitation

Send requests carrying JWTs with random, unpublished `kid` values. Each one causes exactly one outbound HTTPS request from the server to the IdP's JWKS endpoint. In the reporter's reproduction, 120 unknown-`kid` requests produced 120 outbound fetches; the same volume with a published `kid` produced zero. While the cache was still fresh, legitimate tokens kept working — but once the TTL lapsed under a sustained flood, a valid token got a `401`, recovering only after the attack stopped.

## Impact

One-to-one amplification from the MCP server to the IdP, no concurrency limit, and — the sharper edge — if the IdP rate-limits or blocks the flood, JWKS retrieval fails for legitimate tokens too, breaking authentication broadly.

## The fix

`JWTVerifier` now collapses concurrent lookups into a single shared JWKS refresh, waits at least `jwks_refresh_interval` (default 30s) between refresh attempts including failed ones, and keeps serving cached keys while a refresh is pending or has failed. A freshly rotated key may take up to the interval to be recognized; `jwks_refresh_interval=0` restores refresh-on-every-miss. Fixed in 4.1.0 (PR #5456) and 3.4.9 (PR #5769); 2.x users must move to 3.4.9+. As a stopgap, rate-limit unauthenticated requests in front of the server.

## Disclosure

Reported through GitHub Security Advisories; fixed in 3.4.9 and 4.1.0.

## References

- [GHSA-p8g9-xjch-9mxg](https://github.com/PrefectHQ/fastmcp/security/advisories/GHSA-p8g9-xjch-9mxg)
- [CWE-400](https://cwe.mitre.org/data/definitions/400.html) · [CWE-770](https://cwe.mitre.org/data/definitions/770.html)
