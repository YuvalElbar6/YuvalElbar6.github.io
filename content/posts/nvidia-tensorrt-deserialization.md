---
title: "Deserialization of Untrusted Data in NVIDIA TensorRT"
date: 2026-07-14
author: "Yuval Elbar"
tags: ["deserialization", "ml-infra", "code-execution", "nvidia"]
---

**NVIDIA — TensorRT · Moderate (5.3) · CVE-2026-24227 · CWE-502**

A deserialization flaw (CWE-502) in TensorRT: a crafted input can trigger unsafe object loading, with potential for code execution on the host running the engine. The public GHSA entry is thin — as usual for NVIDIA, the authoritative detail is in their own bulletin — so this writeup stays conservative.

## Context

TensorRT compiles models into serialized **engine** artifacts that get loaded and run at inference time. That load step is the dangerous spot: deserialize an engine from an untrusted source without enough validation, and a crafted artifact can influence object construction. The advisory notes a successful exploit "might lead to code execution"; the CVSS vector (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`) scores a network-reachable, low-complexity issue with availability impact and code execution as the escalation.

The practical takeaway is the one that applies to every "load a compiled model" surface: treat engine artifacts like code. An engine from an untrusted registry, a shared cache, a model hub, or a co-tenant is a delivery vector.

## Guidance

- Build engines from source models in your own pipeline rather than importing prebuilt ones.
- Verify integrity (signatures/hashes) before loading third-party artifacts.
- Isolate inference processes that must load untrusted engines.
- Update per NVIDIA's bulletin.

## References

- [GHSA-f54h-33c8-78p4](https://github.com/advisories/GHSA-f54h-33c8-78p4) · [CVE-2026-24227](https://nvd.nist.gov/vuln/detail/CVE-2026-24227)
- [NVIDIA Product Security](https://www.nvidia.com/en-us/security/) · [CWE-502](https://cwe.mitre.org/data/definitions/502.html)
