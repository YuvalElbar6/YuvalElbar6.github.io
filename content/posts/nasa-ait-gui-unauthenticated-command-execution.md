---
title: "Unauthenticated Command Execution in NASA's AIT-GUI"
date: 2026-09-18
author: "Yuval Elbar"
tags: ["command-execution", "auth-bypass", "csrf", "nasa"]
---

**NASA / JPL (AMMOS) · Critical (9.4) · CWE-306 + CWE-352 + CWE-22 · Fixed in 2.5.2 · GHSA-p9r8-2q67-fp86**

AIT-GUI is the web front end of NASA/JPL's AMMOS Instrument Toolkit — the dashboard operators use to send commands to spacecraft instruments. It shipped with no authentication, no CSRF protection, a listener bound to every interface, and path traversal on its script endpoints. Any of those is bad; together, an unauthenticated attacker can relay arbitrary commands to the instrument command bus.

## Four weaknesses

**No auth.** No login, no session, no CSRF token, no CORS restriction on any route. Every endpoint, including the ones that issue commands, is open to whoever reaches the port.

**Bound to everything.** The operator can configure a host to bind to — but the value is read into a variable and never used. The listener is hardcoded to `0.0.0.0`. So setting `host = 127.0.0.1` gets you a service on all interfaces anyway. Config that's silently ignored is worse than none; it hands you false confidence.

**The command relay.** `POST /cmd` takes the `command` field and forwards it straight to the command bus — no auth, no validation:

```bash
curl -X POST http://ground-station:8080/cmd --data 'command=<arbitrary instrument command>'
```

**Path traversal.** `/seq` and `/script/run` build file paths from raw input with no confinement, so `scriptPath=../../../../path/to/any/script` reaches files outside the intended directory — path traversal (CWE-22) wired to an execution primitive.

## Two ways in

Direct: send one `POST /cmd` from the network. Or via CSRF: since any origin can post to these routes, getting an operator to open a malicious page fires the same requests from inside the trusted network — no direct access needed. Either way you issue arbitrary instrument commands and run scripts against ground hardware.

## The fix

AIT-GUI 2.5.2 adds authentication and CSRF tokens, confines the script/sequence paths, and binds to the configured host instead of all interfaces.

## Disclosure

Reported through coordinated disclosure; published on the Cycode blog. Fixed in 2.5.2 (GHSA-p9r8-2q67-fp86).

## References

- [Cycode: Unauthenticated command execution in AIT-GUI](https://cycode.com/blog/ait-gui-unauthenticated-command-execution/)
- [AIT-GUI](https://github.com/NASA-AMMOS/AIT-GUI) · [CWE-306](https://cwe.mitre.org/data/definitions/306.html) · [CWE-352](https://cwe.mitre.org/data/definitions/352.html)
