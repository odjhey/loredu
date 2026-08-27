---
name: m0_application_append_phase_boundaries
description: "Closes custom ClaimPolicy callback handling, reference-read failures, canonical stamping, and in-memory snapshot behavior for the generic M0 append path."
type: decision
tags: [decisions, m0, application, policy, references, capabilities]
generated: "OpenAI coding agent, 2026-08-28"
created_at: 2026-08-28T04:00:00+08:00
---

# 0025: Keep every generic M0 append failure inside its owning phase

## Context

The M0 contracts already fix the public generic append signature and validation → references → entropy → clock → freeze → append order. [ADR 0024](./0024-m0-policy-and-basis-runtime-boundaries.md) also requires generic Claim append to execute the assembled policy against the core-declared ClaimKey without restoring identity remapping. Implementation still had to settle runtime behavior that TypeScript types cannot enforce: malformed or throwing custom callbacks, mutable policy methods after assembly, a store read that throws or returns malformed data, and direct use of the testing store with mutable forged values.

These choices must preserve the landed P0 entropy hardening, the M0-R canonical record decoder, and the M0-P policy shape. They must not add advice, reconciliation, scan/head behavior, provider durability, or another public export.

## Options considered

- Trust custom callback and store return types. Rejected because JavaScript callers can return accessors, malformed arrays, unsupported semantics, or forged records despite the TypeScript declarations.
- Pass through callback and store-read exceptions. Rejected because foreign codes, issues, causes, and messages would escape the phase-owned public error model.
- Call policy semantics even after policy validation rejects the key. Rejected because the append already cannot proceed and the extra consumer callback would add unnecessary side effects.
- Let `InMemoryStore` retain and return caller aliases. Rejected because M0 read and immutability guarantees apply through the testing port as well as through application success.
- Validate and snapshot each phase at its existing boundary, while adding no surface. Chosen.

## Choice

Application assembly validates ClaimPolicy once and captures the validated callback functions and their receiver. Later replacement of public methods does not alter the assembled application. A structurally valid Claim is converted by core into one detached, deeply frozen declared ClaimKey. Append invokes `validateClaimKey` exactly once. Its result must be a descriptor-safe normal dense array of exact `{code,path,message}` data objects: codes use the public issue vocabulary, paths are RFC6901 pointers, and messages are nonempty Unicode-scalar strings. The kernel detaches, freezes, deduplicates by path/code, and orders accepted issues. Any returned issue rejects with `VALIDATION_FAILED`; `semantics` is then not called. An empty result causes exactly one `semantics` call, whose result must be exactly `exclusive` or `coexisting`. A callback throw or malformed result becomes a fresh `VALIDATION_FAILED` with a root issue and leaks no foreign error. Neither callback can return identity.

References are extracted only from the canonical draft and read sequentially in the contract's field/index order. Missing and wrong-kind results accumulate in that same order. Wrong kind includes disagreement between the complete reference id's prefix and the returned record family, even for Relation fields that otherwise allow every family. A `get` throw, malformed returned record, or returned id different from the requested id stops the reference phase and becomes a fresh `REFERENCE_CHECK_FAILED` with no foreign issues or cause. SourceRefs produce no store reads.

After successful validation and references, append makes exactly one ten-byte entropy call and one clock call. It then performs only pure canonical persisted-record construction and recursive freezing before immediately invoking store append. Every family uses its fixed id prefix. Store failure maps freshly to `STORE_APPEND_FAILED` and identifies the attempted id in the non-stable message; only exact `DUPLICATE_RECORD_ID` passes through. Invalid or non-positive returned append positions are store failures. The application never retries and cannot roll back a provider that violated or exercised a separately documented publication contract.

M0 `InMemoryStore` canonicalizes and snapshots a direct append input before assigning a position, returns a fresh detached canonical snapshot from `get`, and changes neither records nor position on malformed or duplicate append. It remains semantics-ignorant: application reference relationships and ClaimPolicy stay outside the store. M1 alone adds scan, stream, head, conformance, and durable-provider behavior.

## Consequences

- All five draft families share one application path and preserve family-narrowed result typing.
- Structural and policy validation consume no record read, entropy, clock, or append capability; reference failures consume no stamping capabilities.
- Callback dispatch is fixed for one assembled application and cannot smuggle active containers, malformed issues, remapped keys, advice, or foreign errors into the kernel; consumer-owned private policy state remains consumer-controlled.
- Reference error order is observable and stable without conflating SourceRefs with record references.
- Testing-store reads prove detachment rather than relying on the application's already-frozen object identity.
- T19, T80, and T83 become executable; T84 and T87 retain their existing ownership while gaining all-family and failure assurance. M1 and later reconciliation remain out of scope.

## Rule / follow-up

M1 may extend `RecordStore` and `InMemoryStore` only additively as fixed by [ADR 0022](./0022-m1-store-and-plain-file-contract.md). It must not move reference or policy semantics into a store. Any future ClaimPolicy advice or reconciliation callback is a separate contract decision with ruleset-version consequences; it cannot weaken declared-key identity or the M0 callback/result boundary recorded here.
