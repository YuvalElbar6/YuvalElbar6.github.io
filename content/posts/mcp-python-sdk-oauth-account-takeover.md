---
title: "OAuth Account Takeover in the MCP Python SDK"
date: 2026-10-01
author: "Yuval Elbar"
tags: ["oauth", "account-takeover", "mcp", "python"]
---

**Anthropic — MCP Python SDK · High (7.5) · OAuth credential theft · Fixed in 1.30.0 and 2.2.0**

A malicious MCP server could steal your OAuth client secret and authorization code during login — even though the only login page you ever saw was the real one. The SDK had a fallback discovery path that skipped issuer validation, so an attacker-controlled server could quietly redirect your credentials to itself.

## Background

The MCP Python SDK can authenticate to a server over OAuth. Before login it discovers the server's auth configuration — where to send the user to log in, which token endpoint to use. There are two ways it does this: a modern metadata endpoint, and an older fallback.

The security of the whole flow rests on one check: validating that the auth server you end up talking to is the one you expected.

## Root cause

Issuer validation was guarded by a condition the fallback path could skip:

```python
if self.context.auth_server_url is not None:
    validate_metadata_issuer(asm, self.context.auth_server_url)
```

If the server answered the modern discovery request with a `404`, the SDK fell back to asking that same server directly for its configuration. On that path `auth_server_url` was never set, so the `if` was false and `validate_metadata_issuer` never ran. The attacker's configuration was taken on trust.

## The attack

1. A malicious MCP server returns `404` for the modern discovery request.
2. The SDK falls back and asks that same server for its OAuth configuration.
3. Issuer validation is skipped, because `auth_server_url` is empty.
4. The malicious config points the *login page* at the **real** provider — so the user sees a legitimate domain and approves.
5. The user gets an authorization code; the SDK sends that code, the client secret, and the PKCE verifier to the **attacker's** token endpoint.
6. The attacker replays them at the real provider and gets a valid access token.

From one connection where the user approved a genuine login page, the attacker walks away with the authorization code and the client secret — which is long-lived and reusable.

## Affected versions and fix

- `1.9.1`–`1.29.1` → fixed in **1.30.0**
- `2.0.0`–`2.1.1` → fixed in **2.2.0**

The fix validates the issuer before any credential exchange, no matter which discovery path was taken.

## Disclosure

Reported through coordinated disclosure; written up on the Cycode blog.

## References

- [Cycode: MCP SDK OAuth flaw enabled account takeover](https://cycode.com/blog/mcp-python-sdk-oauth-account-takeover/)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
