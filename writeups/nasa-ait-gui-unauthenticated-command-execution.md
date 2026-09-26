> [!danger] TL;DR
> **AIT-GUI** — the web front end of NASA/JPL's **AMMOS Instrument Toolkit** — shipped with no authentication, no CSRF protection, a listener hardcoded to all interfaces, and path traversal on its script/sequence endpoints. Together they let an **unauthenticated** attacker relay arbitrary commands straight to the instrument command bus. **GHSA-p9r8-2q67-fp86**, **CVSS 9.4 (Critical)**. Fixed in **2.5.2**.

## The target

The **AMMOS Instrument Toolkit (AIT)** is a framework used to build, test, and operate ground systems for spacecraft instruments. **AIT-GUI** is its web front end: a browser dashboard that operators use to send commands, run scripts, and drive command sequences against the instrument command bus. In other words, this is software that sits directly in front of *"send this command to the hardware."* Getting authentication right here isn't optional.

It wasn't one bug — it was four weaknesses that compound into a pre-auth catastrophe.

## Weakness 1 — the door was never locked (missing auth)

There is **no login requirement, no session gate, no CSRF token, and no CORS restriction on any route.** Every endpoint — including the ones that issue commands — is reachable by anyone who can reach the port, with no credentials.

## Weakness 2 — the listener ignored its own config (hardcoded 0.0.0.0)

The operator can configure a host to bind to (e.g. localhost). But:

> The configured host is read into a variable… and then never used. The listener is hardcoded to all interfaces.

So even an operator who *tried* to keep the GUI local by setting `host = 127.0.0.1` still got a service listening on `0.0.0.0` — exposed to the whole network. Config that is silently ignored is worse than no config: it creates false confidence.

## Weakness 3 — the command relay (unauthenticated `POST /cmd`)

The `POST /cmd` endpoint takes whatever arrives in the `command` field and relays it directly to the command bus, with no validation and no auth:

```bash
# Unauthenticated. No token. No session.
curl -X POST http://ground-station:8080/cmd \
  --data 'command=<arbitrary instrument command>'
```

Whatever the command bus accepts, the attacker can now send.

## Weakness 4 — path traversal on `/seq` and `/script/run`

Both the sequence and script-run endpoints build filesystem paths from **raw input** with no confinement:

```bash
curl -X POST http://ground-station:8080/script/run \
  --data 'scriptPath=../../../../path/to/any/script'
```

So beyond the intended script directory, an attacker can point execution at scripts anywhere the process can read — the same resolve-and-confine failure as classic path traversal (**CWE-22**), but reaching an *execution* primitive.

## Putting it together

Because there's no auth and no CSRF protection, exploitation has two flavors:

- **Direct:** an attacker on the network sends a single `POST /cmd`.
- **Browser-based (CSRF):** because any origin can post to these routes, simply getting an operator to open a malicious web page can fire cross-origin requests from *inside* the trusted network — no direct network access required.

The result: **unauthenticated attackers can issue arbitrary instrument commands, execute scripts, and run command sequences** against spacecraft/ground hardware. On a ground system, that is about as high as impact goes.

## The fix

Upgrade to **AIT-GUI 2.5.2**, which:

- adds an **authentication** layer and **CSRF tokens**,
- enforces proper **path confinement** on `/seq` and `/script/run`,
- and **binds to the configured host** instead of unconditionally to all interfaces.

## Takeaways

1. **Trust boundaries must be enforced, not assumed.** "It's only meant to run on an internal ops network" is not a control. Hardcoded `0.0.0.0` + no auth means the boundary is imaginary.
2. **Config that's read but never used is a vulnerability.** The ignored `host` setting gave operators false assurance.
3. **CSRF is an auth bug too.** Even a purely internal tool needs CSRF/CORS defenses, because the browser is an attacker-reachable path into the internal network.
4. **Command relays need defense in depth:** authentication, authorization, input validation, and path confinement — every layer, because the endpoint's job is literally to execute.

## Disclosure

Reported through coordinated disclosure and published via the **Cycode** research blog; fixed in AIT-GUI **2.5.2**. Advisory **GHSA-p9r8-2q67-fp86**. Author: **Yuval Elbar**.

## References

- [Cycode writeup: Unauthenticated Command Execution in AIT-GUI](https://cycode.com/blog/ait-gui-unauthenticated-command-execution/)
- [GHSA-p9r8-2q67-fp86](https://github.com/advisories/GHSA-p9r8-2q67-fp86)
- [AIT-GUI (NASA/JPL AMMOS)](https://github.com/NASA-AMMOS/AIT-GUI)
- [CWE-306: Missing Authentication for Critical Function](https://cwe.mitre.org/data/definitions/306.html)
- [CWE-352: Cross-Site Request Forgery](https://cwe.mitre.org/data/definitions/352.html)
