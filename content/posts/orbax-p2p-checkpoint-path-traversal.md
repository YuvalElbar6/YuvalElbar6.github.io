---
title: "Path Traversal to Arbitrary File Write in Orbax P2P Checkpointing"
date: 2026-09-10
author: "Yuval Elbar"
tags: ["path-traversal", "arbitrary-write", "ml-infra", "google"]
---

**Google — Orbax · High · CWE-22 · Fixed in PR #3105 (Google OSS VRP)**

Orbax's emergency peer-to-peer checkpoint service trusted the file paths it received from remote peers. A network peer could use `../` to write files outside the staging directory on a training host — arbitrary file write on someone else's box.

## Context

[Orbax](https://github.com/google/orbax) is Google's checkpointing library for JAX. To survive node failures without hammering shared storage, it can exchange checkpoint data peer-to-peer, so a restarting worker recovers state from a neighbor. The moment a service accepts files from other machines, the filenames are untrusted input.

## Root cause

The receiving side built the destination path from peer-controlled input without confining it to the staging directory:

```text
intended:   <staging_dir>/shard-0000.ckpt
malicious:  <staging_dir>/../../../../home/user/.bashrc
            <staging_dir>/../../../../etc/cron.d/pwn
```

It's the write-side version of classic path traversal: not reading files outside a directory, but writing them.

## Impact

Arbitrary file write on a training node means overwriting `authorized_keys`, shell rc files, cron jobs or Python packages on the path — i.e. code execution — plus tampering with checkpoints and training data. In a distributed job the "peers" are exactly the machines worth pivoting between, and one spoofed or compromised peer is enough.

## The fix

PR #3105 confines writes to the staging directory: resolve the target path, reject anything that escapes the intended root.

## Disclosure

Reported through Google's Open Source Software Vulnerability Reward Program, embargoed until the patch merged.

## References

- [Orbax issue #3106](https://github.com/google/orbax/issues/3106) · [PR #3105](https://github.com/google/orbax/pull/3105)
- [Google OSS VRP](https://bughunters.google.com/about/rules/open-source) · [CWE-22](https://cwe.mitre.org/data/definitions/22.html)
