> [!danger] TL;DR
> Orbax's **emergency peer-to-peer checkpoint service** trusted file paths supplied by remote peers. A network-connected peer could use traversal sequences to write files **outside the staging directory** on a victim training host — arbitrary file write, with all the follow-on risk that implies on an ML training node. Reported via **Google's OSS VRP**; fixed in **PR #3105**.

## Context: checkpointing is now attack surface

[Orbax](https://github.com/google/orbax) is Google's checkpointing and persistence library for JAX. Large training runs checkpoint constantly, and to survive node failures without hammering shared storage, Orbax added an **emergency peer-to-peer (P2P) checkpoint** path: peers exchange checkpoint data directly over the network so a restarting worker can recover state from a neighbor.

The moment a service accepts files from other machines, the filenames themselves become untrusted input — and that's where this bug lives.

## Root cause

When receiving checkpoint data from a remote peer, the service built the destination path from peer-controlled input **without confining it to the staging directory**. A malicious or compromised peer could include traversal sequences (`../`) — or otherwise influence the target path — so that the write landed outside the intended staging area:

```text
intended:   <staging_dir>/shard-0000.ckpt
malicious:  <staging_dir>/../../../../home/user/.bashrc
            <staging_dir>/../../../../etc/cron.d/pwn
```

This is the write-side sibling of classic path traversal (**CWE-22**): instead of *reading* files outside a directory, the attacker *writes* them.

## Impact

Arbitrary file write on a training host is severe:

- **Overwrite** trusted files (SSH `authorized_keys`, shell rc files, cron jobs, Python packages on the path) → code execution on the node.
- **Tamper with checkpoints / training data**, corrupting or backdooring model state.
- Because training clusters are high-value, well-connected compute, a single writable node is a strong foothold for lateral movement.

The trust model matters: this requires a network peer, but in a distributed training job the set of "peers" is exactly the set of machines an attacker would love to pivot between, and a single compromised or spoofed peer is enough.

## The fix

Fixed upstream in **PR #3105**: the receiving side now confines writes to the staging directory — resolving the target path and rejecting anything that escapes the intended root — so peer-supplied names can no longer redirect a write elsewhere on disk.

## Takeaways

1. **Distributed ≠ trusted.** "Internal" peer-to-peer protocols still carry attacker-controllable fields. Filenames from a peer are input.
2. **Confine writes, not just reads.** Path-traversal defenses are usually discussed for file *serving*; the same resolve-and-verify discipline applies to every file *write* built from external data.
3. **ML infrastructure is a target.** Fast-moving training and serving code inherits every classic web bug class — often without the web-app security review that would normally catch them.

## Disclosure

Reported through **Google's Open Source Software Vulnerability Reward Program (OSS VRP)**, and kept under embargo until the upstream patch merged. Reporter: **YuvalElbar6**.

## References

- [Orbax issue #3106](https://github.com/google/orbax/issues/3106)
- [Fix: Orbax PR #3105](https://github.com/google/orbax/pull/3105)
- [Google OSS VRP](https://bughunters.google.com/about/rules/open-source)
- [CWE-22: Path Traversal (MITRE)](https://cwe.mitre.org/data/definitions/22.html)
