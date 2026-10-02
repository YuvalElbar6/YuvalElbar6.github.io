---
title: "Hardening aiohttp's CookieJar.load() Against Unsafe Deserialization"
date: 2026-07-20
author: "Yuval Elbar"
tags: ["deserialization", "python", "upstream-fix", "aiohttp"]
---

**aio-libs — aiohttp · Moderate (6.4) · CVE-2026-34993 · CWE-502 · Fixed in 3.14**

This one is a fix I contributed, not a find — worth being clear about. The vulnerability (unsafe deserialization in `CookieJar.load()`, CVE-2026-34993) was reported by **tsigouris007**; I wrote the upstream patch (`dcf40f3`) that shipped in aiohttp 3.14.

## The bug

`CookieJar` can persist cookies to disk and reload them:

```python
jar.save("cookies.pickle")
jar.load("cookies.pickle")   # deserialized without validation
```

`load()` deserialized the file without validation, so a file the attacker controls could lead to code execution when the object is reconstructed (CWE-502). The advisory is honest about scope — "most applications using this function will be doing so with the user's own data" — so the real risk is when the file crosses a trust boundary: downloaded, shared, restored from an untrusted backup, or written by a lower-privileged component.

## The fix

The patch in 3.14 (`dcf40f3`) hardens the load path so reconstructing a jar from a file no longer deserializes arbitrary objects — the file is treated as data, not a blueprint for building Python objects. On older releases, the workaround is to not call `load()` on a file you don't control.

Reporting is only half the job; landing a correct patch upstream is the other half. Credit for the find goes to tsigouris007 — my part was the fix.

## References

- [GHSA-jg22-mg44-37j8](https://github.com/aio-libs/aiohttp/security/advisories/GHSA-jg22-mg44-37j8) · [CVE-2026-34993](https://nvd.nist.gov/vuln/detail/CVE-2026-34993) · [CWE-502](https://cwe.mitre.org/data/definitions/502.html)
