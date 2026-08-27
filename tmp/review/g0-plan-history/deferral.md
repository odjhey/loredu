# Loredu G0 lineage deferral — replan budget exhausted

**Recorded:** 2026-08-27 09:51 UTC  
**Project/workset:** Loredu M0, G0 workspace-boundary proof  
**Planning base:** `master@612ddcb0f23d0177b806942f89a158c50267b926`, tree `1216774a600c79894138a7a99d810617789ed0f8`  
**Current implementation candidate:** none authorized  
**Historical PRs:** #32 and #35 are rejected, preserved evidence only  
**Accounting:** `attempt_count: 5`; `attempt_limit: 20`; `replan_count: 4`; `replan_limit: 4`

## Current evidence state

Final replan4 artifact `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-4--01M11900E198Q4YEN3KHYRZCFY/g0-replan4-final.md`, SHA-256 `ae657d6713c58c7e58cf806085b9ad99a2a072f05571b25cc4bb924f8d27e304`, was independently rejected by terminal Reviewer task `loredu-g0-replan4-final-review--01M119G3D0KCJAXJS33X9T0D7C`.

No S0/A0 dispatch, implementation, current CI, merge-readiness, or delivery evidence exists. Historical green CI for rejected PR32/35 heads is not acceptance evidence.

## Blocking findings

1. `ReferenceStage` cannot compose from declared inputs: it requires A/F-owned arbitrary target path kind/surface facts but receives no `WorkspaceInventory`; supplying them would require forbidden reread/reclassification or duplicate authority.
2. Slice-owned path manifests remain incomplete or optional across S1/S2/S3/S4/S6/S8 and optional G1-schema integration, preventing deterministic ownership and changed-head invalidation.
3. G1's mandatory corpus includes watchdog, selector, aggregate, and CI cases owned by S7, but S6 requires the complete corpus to execute against I0 only; the corpus lacks an explicit owner/execution partition.
4. The advertised S0→S8 stack is not fully fixed because optional G1 schema and conditional S8 have no deterministic parent, paths, or integration contract.

## Directions already attempted

- Original monolithic workspace scanner and PR32 finite policy patching.
- Replan1 layered but single replacement PR architecture; PR35 remained false-green.
- Replan2 small stacked A0/A-F/B-C-E/D/G1/G2/I plan with typed stage contracts, mutation ledger, fixtures and watchdog; amended plan retained circular composition and incomplete executable contracts.
- Replan3 introduced I0 before executable G1 and froze source/program/mutation/fixture/watchdog contracts; audit found remaining typed composition and acceptance contradictions.
- Replan4 added manifest registry, stage cardinality, closed MatrixRow, root exclusion, mutation deltas, Ubuntu watchdog seam, legacy migration, changed states, TS grammar, and fatal exits; terminal audit found the four blockers above.

## Deferral decision

Class remains `NEEDS_REPLAN`, but no further Replanner or Coder may be dispatched because the configured replan budget is exhausted. G0 is deferred. Unrelated Loredu, Rozoro, and Xatu work remains runnable.

## Objective resumption trigger

Resume only when materially new authority or tooling changes the premise, or when the operator explicitly reprioritizes and authorizes a new bounded planning lineage/budget policy after reviewing the preserved plans and terminal findings. Counters do not silently reset. Any resumed plan must begin by resolving the four blockers above, not by restating replan4 or patching them inside S0.
