---
title: "Server-Side Request Forgery in pydantic-ai URL Download"
date: 2026-07-08
author: "Yuval Elbar"
tags: ["ssrf", "cloud-metadata", "ai-agents", "pydantic"]
---

**Pydantic — pydantic-ai · High (8.6) · CVE-2026-25580 · CWE-918 · Fixed in 1.56.0**

`download_item()` fetched user-supplied URLs with no check on the target. In any app that feeds message history or attachments to an agent, an attacker could aim the download at `http://169.254.169.254` or an internal service and read the response — cloud-metadata credential theft from a chat message. Co-reported with **doredry**.

## Why this is an SSRF

SSRF (CWE-918) is getting an app to make requests to a destination the attacker picks. In the cloud it's dangerous because of the instance metadata service — `169.254.169.254` on AWS/GCP/Azure, which hands temporary credentials to anything that can reach it from inside the instance. AI frameworks make it newly relevant: agents accept attachments and history containing URLs, and the framework downloads them so the model can read them.

## The bug

`download_item()` issued a request to a URL that ultimately came from user-controlled data, with no check that the resolved host is public:

```text
http://127.0.0.1:8000/            # loopback: internal admin/debug
http://169.254.169.254/latest/... # cloud metadata → credentials
http://10.0.0.5:6379/             # private range: internal services
```

Any app on pydantic-ai `>= 0.0.26` exposing a web interface or API where history reaches the model was affected.

## The fix

1.56.0 adds real SSRF protection: scheme validation, DNS resolution followed by private/link-local IP blocking (closing rebinding tricks), explicit metadata-endpoint blocking, and safe redirect handling so a public URL can't 302 you inward. There's an opt-in `force_download='allow-local'` for trusted environments, but metadata endpoints stay blocked. The check that holds up is on the *resolved* IP, not the raw string — and it has to re-check across redirects.

## Disclosure

Reported through GitHub Security Advisories; co-credited to **YuvalElbar6** and **doredry**. Fixed in pydantic-ai / pydantic-ai-slim 1.56.0.

## References

- [GHSA-2jrp-274c-jhv3](https://github.com/pydantic/pydantic-ai/security/advisories/GHSA-2jrp-274c-jhv3) · [CVE-2026-25580](https://nvd.nist.gov/vuln/detail/CVE-2026-25580) · [CWE-918](https://cwe.mitre.org/data/definitions/918.html)
