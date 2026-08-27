---
name: strict_rfc3339_instant_domain
description: "Narrows Instant to the epoch-millisecond range that always renders strict four-digit-year RFC3339."
type: decision
tags: [decisions, m0, contracts, time]
generated: "OpenAI coding agent, 2026-08-27"
created_at: 2026-08-27T14:30:00+08:00
---

# 0021: Keep every Instant within strict RFC3339

## Context

[ADR 0020](./0020-m0-public-contract-closure.md) §5 required both the full ECMAScript TimeClip range and canonical `YYYY-MM-DDTHH:mm:ss.sssZ` output. Those requirements conflict at the extrema: ECMAScript renders expanded years such as `-271821` and `+275760`, while the public timestamp contract requires exactly four year digits. The repeated P0 boundary review recorded this gap as CM-N06 in issue [#30](https://github.com/odjhey/loredu/issues/30#issuecomment-5434979627).

## Options considered

- Accept expanded-year ECMAScript ISO text. Rejected because it breaks the promised strict four-digit-year RFC3339 field.
- Clamp TimeClip extrema into the four-digit-year range. Rejected because clamping silently changes the instant.
- Keep the full TimeClip domain but allow append-time rendering to fail. Rejected because `createInstant` would accept values the application cannot persist.
- Narrow Instant to the exact strict-RFC3339-epoch-millisecond interval that permits strict RFC3339. Chosen because every valid Instant can then be rendered without changing the timestamp grammar or value.

## Choice

`Instant` is an opaque safe-integer number of milliseconds since the Unix epoch in this inclusive interval:

```text
-62_167_219_200_000  => 0000-01-01T00:00:00.000Z
253_402_300_799_999  => 9999-12-31T23:59:59.999Z
```

`createInstant` accepts exactly safe integers in that interval. Every value returned by a runtime `Clock` is validated against the same type, integer, and range rules before rendering. Caller-provided RFC3339 fields must remain inside the interval after applying their explicit offset and normalizing to UTC.

This decision **partially supersedes only ADR 0020 §5** and derived contract wording that admits the whole TimeClip range. Epoch-millisecond representation, safe-integer validation, UTC normalization, accepted offset/fraction grammar, strict four-digit years, and rejection of local, leap-second, and unknown-offset forms remain unchanged.

## Consequences

- CM-N06 is `IN_SCOPE` and refines CM-A05 and matrix invariants CM-I08–I10.
- The Clock, record timestamp, and public constructor contracts use one range, so a constructed or caller-normalized instant is always able to be persisted in canonical form.
- Existing P0/R1 supplemental timestamp-boundary evidence under T02, T80, and T84 covers both extrema, one millisecond outside each bound, runtime Clock validation, and caller normalization near offsets. No catalog row, milestone owner, dependency edge, or graph shape changes.
- The implementation plan says “strict-RFC3339 boundaries,” not “TimeClip boundaries.”

## Rule / follow-up

Validate host capability results at runtime even when TypeScript branding is present. Out-of-domain Clock returns map to the phase-owned `CLOCK_FAILED` operational error and never reach the store. Do not broaden canonical record text to expanded-year ISO and do not normalize an invalid Instant by clamping or truncating it.
