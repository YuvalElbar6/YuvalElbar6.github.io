---
title: "Deserialization of Untrusted Data in NVIDIA TensorRT"
date: 2026-07-14
author: "Yuval Elbar"
tags: ["deserialization", "ml-infra", "code-execution", "nvidia"]
---

**NVIDIA · Moderate (5.3) · CVE-2026-24227 · CWE-502**

> **TL;DR** — A deserialization of untrusted data flaw (CWE-502) in NVIDIA TensorRT: a crafted input can trigger unsafe object loading, with potential for code execution on the host running the engine. Tracked as CVE-2026-24227. The public GHSA entry is intentionally sparse — as is typical for NVIDIA advisories, the authoritative detail lives in NVIDIA's own security bulletin.

## Context

[TensorRT](https://developer.nvidia.com/tensorrt) is NVIDIA's high-performance deep-learning inference SDK. Models are compiled into serialized **engine** artifacts that are then loaded and executed at inference time. That load step is exactly the kind of place where CWE-502 (Deserialization of Untrusted Data) becomes dangerous: if a serialized artifact from an untrusted source is deserialized without sufficient validation, a maliciously crafted artifact can influence object construction in unsafe ways.

## The issue

Per the advisory, the vulnerability lets an attacker cause deserialization of untrusted data, and *"a successful exploit of this vulnerability might lead to code execution."* The CVSS vector (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`) records a network-reachable, low-complexity issue whose scored impact is on availability, with code execution called out as a possible escalation.

The practical threat model is the one that applies to all "load a compiled model/engine" surfaces: **treat engine artifacts as code, not data.** An engine file obtained from an untrusted registry, a shared cache, a model hub, or a co-tenant is a potential delivery vector.

> **Model artifacts are executables.** The ML supply chain routinely passes around serialized weights and compiled engines as if they were inert files. Deserialization bugs like this are a reminder that loading one can be equivalent to running attacker-influenced code. Only load engines you built yourself or obtained over a verified, integrity-checked channel.

## Guidance

- **Rebuild, don't import blindly.** Prefer building TensorRT engines from source models in your own trusted pipeline over importing prebuilt engines from third parties.
- **Verify integrity** (signatures / hashes) of any engine artifact before loading.
- **Isolate** inference processes that must load third-party artifacts (least privilege, sandboxing) so a load-time compromise is contained.
- **Update** to the fixed TensorRT release per NVIDIA's bulletin.

## A note on detail

I'm keeping this writeup deliberately conservative: the public GHSA record for this CVE does not publish deep technical internals, and NVIDIA generally centralizes the definitive details (affected versions, fixed builds, acknowledgements) in its own security bulletin. Rather than reconstruct specifics that aren't publicly confirmed, I link to the authoritative sources below.

## References

- [GHSA-f54h-33c8-78p4 (GitHub advisory)](https://github.com/advisories/GHSA-f54h-33c8-78p4)
- [CVE-2026-24227](https://nvd.nist.gov/vuln/detail/CVE-2026-24227)
- [NVIDIA Product Security](https://www.nvidia.com/en-us/security/)
- [CWE-502: Deserialization of Untrusted Data (MITRE)](https://cwe.mitre.org/data/definitions/502.html)
