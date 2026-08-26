---
name: decision_m0_validation_rules
description: "Pins the M0 validation rules the contracts referred to but never defined: identifier-safe token shape, scope structure and identity, value equality, which vocabularies are closed, metadata namespacing, and schema acceptance."
type: decision
tags: [decisions, contracts, records, validation]
generated: "Claude Opus 5 (Claude Code), 2026-08-26"
created_at: 2026-08-26T22:00:00+08:00
---

# 0019: M0 validation rules

## Context

M0 is about to be implemented by agents working in parallel, from these documents alone. Read that way, several rules the contracts *rely* on turn out to be named but never defined — and each one is a place where independent implementers would each invent something reasonable and incompatible.

The clearest case: [T04](../v0.x/execution/first-user-journey.md) asserts that a claim with free prose in `subject.id` is rejected, and [decision 0004](./0004-claim-identity-key.md) says the kernel validates "shape only (identifier-safe characters, no free prose)". No document says what identifier-safe *means*. A test cannot be written against that, and two adapters that guess differently will disagree about which records are valid — the exact divergence the shared kernel exists to prevent ([decision 0005](./0005-embedded-kernel-compatibility.md)).

The same shape of gap appears in five more places, listed below. None of these is a new design direction; each pins a rule the contracts already imply, so that it is implemented once rather than five times.

## Choice

### 1. Identifier-safe token

Used by `subject.type`, `subject.id`, `predicate`, `perspective`, `actor.id`, and both halves of a scope pair:

```text
^[a-z0-9]([a-z0-9._:/-]*[a-z0-9])?$      max 128 characters
```

Lowercase only, no whitespace, no leading or trailing separator. Separators are permitted *inside* a token so consumers can express their own namespacing (`code-area/command-registration`, `policy:retention`) without the kernel learning their vocabulary.

**Lowercase is enforced rather than normalized.** Two keys differing only in case would otherwise be distinct keys that a human reads as identical — silent reconciliation divergence, which is precisely the failure decision 0004 exists to prevent. Rejecting at write time makes it a loud error in the consumer's terms instead of a quiet miss inside the kernel. Consumers that carry mixed-case identifiers lowercase them on the way in; that mapping is theirs, not the kernel's.

**Source refs are deliberately not identifier-safe.** A `sources[].ref` may be a URL, a file path, or a vendor id, so it is any non-empty trimmed string up to 1024 characters. Constraining it would make real evidence impossible to record.

### 2. Scope

`scope` is a **flat, unordered map of identifier-safe key to identifier-safe value**. No nesting. An absent scope and `{}` are the same thing: unscoped.

Because scope participates in the claim key, identity needs a canonical form: **the set of pairs, compared order-insensitively**. Two claims whose scope maps differ only in pair order share a key; adding a pair produces a different key. Nesting is refused because it would make both identity comparison and CLI expression ambiguous, and no candidate consumer needs it.

### 3. Value equality

`value` is required on a claim and must be JSON-serializable. Under the default `exclusive` semantics ([decision 0010](./0010-claim-policy-seam.md)), the kernel must decide whether two values *differ*, so:

- equality is **structural over a canonical form** — object keys sorted, insignificant whitespace removed;
- **types are never coerced**: `1` and `"1"` are different values, so under one key they are a conflict candidate rather than a duplicate;
- `null` is a value, and differs from an absent field;
- string comparison is exact — no trimming, no case folding. Values are consumer data, not identifiers.

Type coercion is refused because a kernel that decides `1` and `"1"` are the same fact has made a judgment, which is the one thing it must never do ([decision 0008](./0008-cli-first-agent-reactive.md)).

### 4. Closed and open vocabularies

An enumeration is **closed** — validated, unknown values rejected — when kernel mechanics depend on it:

`kind`, `actor.type`, relation type, resolution `decision`, verification `result`, `confidence`.

An enumeration is **open** — recommended values, unknown values accepted and preserved — when it is descriptive and the kernel never branches on it:

`entry_type`, `claim_class`.

The line is *does the kernel act on this value*. Closing a descriptive vocabulary would grow the predicate ontology decision 0010 refuses; opening a mechanical one would make behavior undefined for inputs the kernel must handle.

### 5. Metadata namespacing

`metadata` is a flat map. Keys are `<namespace>.<name>`, both halves identifier-safe; values are JSON-serializable. A key with no namespace is **rejected**, which is what makes "unknown namespaced metadata is preserved" ([decision 0005](./0005-embedded-kernel-compatibility.md)) a meaningful guarantee rather than a hope. `loredu.` is reserved for the kernel; every other namespace is preserved verbatim and ignored by readers that do not understand it.

### 6. Schema acceptance

`schema` must be exactly a schema identity this kernel knows how to replay. On write, an unknown schema identity is rejected. On read, a record carrying an unknown schema identity is surfaced as an **actionable error, never silently skipped** — invariant 9 promises persisted records are never stranded, and a record quietly omitted from a replay is stranded in the way that matters.

## Consequences

- T03, T04, and T06 become implementable as written; before this they described rules that did not exist.
- Enforcing lowercase will reject identifiers some consumers hold in mixed case. That is a deliberate cost, paid at the boundary where the consumer can see it.
- Value canonicalization has to be implemented once in the kernel and used by both reconciliation and any adapter comparing values, or two comparisons will disagree. It belongs beside the record types, not in the store.
- Catalog gains [T85 and T86](../v0.x/execution/first-user-journey.md) for scope identity and value equality.
- These are shape rules only. Nothing here interprets consumer vocabulary; the ownership split of decision 0010 is unchanged.

## Rule / follow-up

- Definitions of record: [record contract](../architecture/contracts/records.md).
- If a real consumer cannot live with lowercase-only identifiers, that is a superseding record, not a local exception — and it should say what it does about case-divergent keys instead.
