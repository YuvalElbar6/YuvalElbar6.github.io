---
title: "Path Traversal in Microsoft's Container-Migration-Solution-Accelerator"
date: 2026-09-01
author: "Yuval Elbar"
tags: ["path-traversal", "fastapi", "cloud", "microsoft"]
---

**Microsoft · High · CWE-22 · Fixed in commit `3a0ec34`**

One line in a FastAPI catch-all route let anyone read arbitrary files off the server, unauthenticated. In a container that means the app's source, `/etc/passwd`, and — the part that actually hurts — the process environment, which is where the secrets live.

## Path traversal, briefly

Path traversal (CWE-22) happens when an app builds a filesystem path from user input without checking that the result stays inside the intended directory. Feed it `../` and you climb out: `/var/www/files/` + `../../../etc/passwd` → `/etc/passwd`. Character blacklists fail (URL-encoding, double-encoding, symlinks all get around them); the only reliable check is to resolve the path fully and confirm it's still inside the allowed directory.

## The target

Container-Migration-Solution-Accelerator is a Microsoft open-source project that migrates container configs to Azure Kubernetes Service. The frontend isn't served by nginx — the developers wrote a small **FastAPI** server, `frontend_server.py`, to serve the React build. That's where the bug is.

## The vulnerable code

```python
BUILD_DIR = os.path.join(os.path.dirname(__file__), "dist")
INDEX_HTML = os.path.join(BUILD_DIR, "index.html")

@app.get("/{full_path:path}")
async def serve_app(full_path: str):
    file_path = os.path.join(BUILD_DIR, full_path)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return FileResponse(INDEX_HTML)
```

Two things combine here. `{full_path:path}` is Starlette's path converter — unlike a normal parameter, it keeps the slashes, so `../../etc/passwd` arrives intact. And `os.path.join` has a well-known trap: hand it an absolute path and it throws away everything before it; hand it `../` and it just climbs.

```python
>>> os.path.join("/app/frontend/dist", "../../../etc/passwd")
'/app/frontend/dist/../../../etc/passwd'
>>> os.path.join("/app/frontend/dist", "/etc/passwd")
'/etc/passwd'
```

## Exploitation

No auth, just a `GET` with a URL-encoded traversal:

```bash
# /etc/passwd
curl "http://localhost:3000/..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd"

# the app's own source
curl "http://localhost:3000/..%2Ffrontend_server.py"

# process environment — API keys, Azure connection strings, tokens
curl "http://localhost:3000/..%2F..%2F..%2F..%2F..%2Fproc%2Fself%2Fenviron"
```

Two details matter. `%2F` survives client/proxy normalization and only gets decoded inside Starlette — exactly where it shouldn't. And the check uses `os.path.exists`, not `os.path.isfile`, so it happily serves virtual files like `/proc/self/environ`.

That last one is the payoff. Secrets aren't hardcoded — they're injected as environment variables, which `/proc/self/environ` exposes in cleartext. The frontend runs in the same Azure Container Apps environment as the API and Processor, so its leaked connection strings reach Blob Storage, Storage Queue, and Cosmos DB.

## The /config endpoint

Separately, `/config` returned MSAL client IDs, the Azure AD authority, API URLs, and scopes to any unauthenticated caller — with `allow_origins=["*"]`, so any website could read them from a victim's browser too.

## The fix

Resolve the path, then confirm it's inside the build directory (commit `3a0ec34`):

```python
file_path = os.path.realpath(os.path.join(BUILD_DIR, full_path))
build_dir_real = os.path.realpath(BUILD_DIR)
if not file_path.startswith(build_dir_real + os.sep) \
        and file_path != build_dir_real:
    return FileResponse(INDEX_HTML)
if os.path.isfile(file_path):
    return FileResponse(file_path)
```

`realpath` collapses the `../` and resolves symlinks; the `startswith(build_dir_real + os.sep)` check confirms containment. The `os.sep` isn't optional — without it, `/app/dist-evil` would pass just for starting with `/app/dist`. The patch also added an allow-list CORS policy and an Origin check on `/config`.

## Disclosure

Reported to Microsoft; fixed in commit `3a0ec34`. First published in Hebrew in Digital Whisper (September 2026) — [original article (PDF)](/papers/path-traversal-container-migration-digital-whisper-he.pdf).

## References

- [Container-Migration-Solution-Accelerator](https://github.com/microsoft/Container-Migration-Solution-Accelerator)
- [CWE-22 (MITRE)](https://cwe.mitre.org/data/definitions/22.html)
- [Path traversal (PortSwigger)](https://portswigger.net/web-security/file-path-traversal)
