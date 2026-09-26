---
title: "Hardening aiohttp's CookieJar.load() Against Unsafe Deserialization"
date: 2026-07-20
author: "Yuval Elbar"
tags: ["deserialization", "python", "upstream-fix", "aiohttp"]
---

**aio-libs · Moderate (6.4) · CVE-2026-34993 · CWE-502 · Fixed in 3.14**

> **Role and TL;DR.** This one is a *fix contribution*, not a discovery — I want to represent it honestly. The vulnerability in `aiohttp`'s `CookieJar.load()` (unsafe deserialization, CWE-502, CVE-2026-34993) was reported by **tsigouris007**. I authored the upstream remediation (commit `dcf40f3`) that shipped in aiohttp 3.14.

## The vulnerability

`aiohttp` is one of the most widely used async HTTP libraries in the Python ecosystem. Its `CookieJar` can persist cookies to disk and reload them:

```python
jar = CookieJar()
jar.save("cookies.pickle")
# later…
jar.load("cookies.pickle")   # deserializes without validation
```

`CookieJar.load()` deserialized the file without validation. If an attacker can control the contents of the file that gets loaded, unsafe deserialization (CWE-502) can lead to arbitrary code execution when the object is reconstructed.

The advisory is careful about real-world exposure, and so am I: *"most applications using this function will be doing so with the user's own data,"* which limits practical impact. The risk is real specifically when the cookie-jar file crosses a trust boundary — e.g. it's downloaded, shared, restored from an untrusted backup, or written by a lower-privileged component.

- **Affected:** `aiohttp < 3.14`
- **Severity:** Moderate (CVSS 6.4)

## The fix I contributed

The remediation shipped in 3.14 (commit `dcf40f3`) hardens the load path so that reconstructing a cookie jar from a file no longer performs unsafe deserialization of arbitrary objects — the loaded data is treated as data, not as a blueprint for building arbitrary Python objects.

For anyone stuck on an older release, the documented workaround is to sanitize the files before loading — i.e. never call `load()` on a file whose provenance you don't fully control.

> **Deserialization hygiene.** Treat any `pickle`/`load` of externally-influenced data as code execution. Prefer explicit, schema-validated formats (JSON with a defined shape) for anything that might cross a trust boundary, and reserve native serialization for data your own process fully controls end-to-end.

## Why I'm listing a fix, not just finds

Coordinated disclosure is only half the job — the other half is landing a correct patch upstream. Contributing the remediation for a CVE in a library as widely deployed as aiohttp is, to me, as much a part of security work as finding the bug. I'm crediting **tsigouris007** for the discovery and reporting; my part was the fix.

## Disclosure and credit

- **Reporter:** tsigouris007
- **Remediation author:** YuvalElbar6 (commit `dcf40f3`, shipped in aiohttp 3.14)

## References

- [GHSA-jg22-mg44-37j8 (advisory)](https://github.com/aio-libs/aiohttp/security/advisories/GHSA-jg22-mg44-37j8)
- [CVE-2026-34993](https://nvd.nist.gov/vuln/detail/CVE-2026-34993)
- [CWE-502: Deserialization of Untrusted Data (MITRE)](https://cwe.mitre.org/data/definitions/502.html)
