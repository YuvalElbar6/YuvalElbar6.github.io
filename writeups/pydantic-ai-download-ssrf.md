> [!danger] TL;DR
> `pydantic-ai`'s `download_item()` fetched user-supplied URLs with **no validation of the target**. In any app that feeds message history (or file attachments) into an agent, an attacker could point the download at `http://169.254.169.254` or internal services and read the response — turning a chat message into **cloud-metadata credential theft** and internal network reconnaissance. Tracked as **CVE-2026-25580** (CVSS 8.6). Co-reported with **doredry**; fixed in **1.56.0**.

## Background: SSRF in the age of AI agents

Server-Side Request Forgery (**CWE-918**) is when an application can be tricked into making HTTP requests to a destination the attacker chooses. In cloud environments it's especially dangerous because of the **instance metadata service** — a magic link-local address (`169.254.169.254` on AWS/GCP/Azure) that hands out temporary credentials to whatever can reach it from inside the instance.

AI frameworks make SSRF newly relevant. Agents routinely accept **attachments** and **message history** that can contain URLs, and the framework helpfully downloads them so the model can "see" the content. If that download isn't restricted to public internet targets, the model's helpfulness becomes the attacker's SSRF primitive.

## The vulnerable pattern

`download_item()` accepts a URL that ultimately originates from user-controllable data — for example a file attachment in a submitted chat message — and issues an HTTP request to it. There was **no check** that the resolved host is a public address before the request went out. That means an attacker could supply:

```text
http://127.0.0.1:8000/            # loopback: internal admin panels, debug endpoints
http://169.254.169.254/latest/... # AWS instance metadata → temporary credentials
http://10.0.0.5:6379/             # private-range: internal databases, caches
```

Any application built on pydantic-ai (`>= 0.0.26`) that exposes a web interface or custom API where message history reaches the model was exposed.

## Impact

- **Credential theft** from cloud metadata endpoints (AWS/GCP/Azure), leading to broader account compromise.
- **Access to internal services and databases** not reachable from the internet.
- **Internal network reconnaissance** by probing private IP ranges and observing responses/timing.

The scope change in the CVSS vector (`S:C`, confidentiality `C:H`) reflects exactly this: a request that leaves the app's trust boundary and reads secrets it should never see.

## The fix

Version **1.56.0** adds comprehensive SSRF protection to the download path:

- **Protocol validation** — only expected schemes are allowed.
- **DNS resolution before the request**, then blocking of **private / link-local IP ranges** — closing DNS-rebinding-style bypasses where a public name resolves to an internal address.
- **Cloud-metadata endpoint blocking** (`169.254.169.254` and friends).
- **Safe redirect handling**, so a public URL can't 302 you into an internal one.

An optional `force_download='allow-local'` escape hatch permits local access in trusted environments — but cloud-metadata endpoints stay blocked even then.

## Takeaways

1. **Resolve, then validate.** As with path traversal, the robust check happens on the *resolved* target (the IP after DNS), not the raw string. Validate DNS results, and re-validate across redirects.
2. **"The model asked for it" is still attacker input.** Anything derived from message history, tool output, or attachments is untrusted. Downloads driven by that data need the same egress controls you'd put on any user-driven fetch.
3. **Block metadata endpoints explicitly** in any server that talks to the outside world on behalf of users.

## Disclosure

Reported through GitHub Security Advisories and co-credited to **YuvalElbar6** and **doredry**. Fixed in pydantic-ai / pydantic-ai-slim **1.56.0**.

## References

- [GHSA-2jrp-274c-jhv3 (advisory)](https://github.com/pydantic/pydantic-ai/security/advisories/GHSA-2jrp-274c-jhv3)
- [CVE-2026-25580](https://nvd.nist.gov/vuln/detail/CVE-2026-25580)
- [CWE-918: Server-Side Request Forgery (MITRE)](https://cwe.mitre.org/data/definitions/918.html)
