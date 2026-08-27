# Loredu G0 plan history and terminal-audit report

**As of:** 2026-08-27 09:45 UTC  
**Project:** `/Users/tiny/packages/loredu`  
**Accepted planning base:** `master@612ddcb0f23d0177b806942f89a158c50267b926`, tree `1216774a600c79894138a7a99d810617789ed0f8`  
**Contract Matrix scope:** CM-I41, CM-I43, CM-I44, CM-I45, CM-I46, CM-I47, CM-I50  
**Implementation state:** no replacement G0 implementation is authorized yet. Attempt count is 5; the next implementation would be attempt 6. Replan count is 4/4.

## Executive summary

G0 is the M0 workspace-boundary proof: it must mechanically enforce Loredu's package DAG, test-only seam, environment/capability restrictions, time/random restrictions, TypeScript isolation, complete source/control/export inventory, and fail-closed CI authority.

PRs #32 and #35 repeatedly reached green CI but independent assurance showed that the checks did not prove all contract semantics. Those heads are preserved as immutable historical evidence and are not implementation sources or acceptance evidence. The work was therefore replanned from a monolithic scanner into a typed, staged, continuously mergeable proof with literal case accounting, mutation sensitivity, deterministic fixtures, and one watchdog-wrapped root authority.

The fourth and final plan is now under terminal independent matrix review. A passing verdict makes S0 dispatchable. A material planning defect exhausts the 4/4 replan budget and defers the lineage rather than permitting another plan or task-local invention.

## Historical implementation evidence

- PR #32 attempt 3: `fc5b79bfc23b902069b0544d6c66944954df3cf7`, tree `a0a2a401adfc2a9aa64fc3f38c111138c7381432`, CI `33044928321`.
- PR #35 attempt 4: `207d572e63cacc3d4b2843c6410ea3152bc62f30`, tree `fef6f92694fd6683d2943b8c560bd6b9df89d031`, CI `33049957913`.
- PR #35 attempt 5: `a945521af7d3a8415f071322b577be6865f9ed8f`, tree `06c42f72db78d83e084b39b4c281a59ab7929335`, CI `33052334867`.

All three green runs are retained as false-green evidence. Their commits, trees, annotated evidence refs, bundles, manifests, and reports remain preserved. No replacement branch may cherry-pick them.

## Plan evolution

### Initial G0 decomposition

The M0 Planner defined G0 as the workspace scaffold and architecture guard for the seven matrix rows. Early implementation treated it largely as one scanner/PR. Assurance established that finite syntax lists, overlapping scanners, incomplete TypeScript reference extraction, weak capability analysis, and path existence checks could all produce green CI without complete boundary proof.

Source: `/Users/tiny/.rozoro/tasks/loredu-m0-20260827T034627Z-planner--01M10N896VVRYHC354S7QN0RX7/m0-decomposition.md`

### Replan 1 — replacement boundary proof

**SHA-256:** `938bb7303ba1004bca8e3f3e614e5e3e2bab91490233e5e39ac20af7a4ea829c`

Replan 1 retired PR #32 and proposed one clean replacement PR with serial internal worksets. It introduced a layered model: filesystem inventory, syntactic package law, TypeScript reference extraction/resolution, semantic capability analysis, compiler isolation, manifest/export policy, and CI/corpus/mutation evidence.

It materially improved the architecture, but still concentrated authority in one replacement PR and left assurance vulnerable to scanner composition, mutation, totality, and ledger-completeness gaps. PR #35 demonstrated that this design could still be green while incomplete.

Artifact: `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-1--01M10YFBD36CT0XCW8MKZXDX19/g0-replan-1.md`

### Replan 2 — small stacked slices and executable evidence

**Original SHA-256:** `9d25ec0a5c025a7ec22c46ac4abd0fe2f08c0d06793f3323b6130322fa3c2a64`  
**Amended SHA-256:** `ee64309175e3034a4179ac9a3c04f623eb0d008404dcd0502a4c2219d19ba63c`

Replan 2 retired PR #35 and replaced the monolith with stacked slices: A0, A/F, B/C/E, D, G1, G2, and I. It added sole fact owners, typed stage boundaries, one source snapshot, exact check/mutation mapping, a literal case ledger, deterministic fixture operations, watchdog rules, and immutable handoffs.

The initial matrix audit found seven correction classes. The amended plan incorporated them, but final audit still found material defects: incomplete frozen internal types, a circular dependency in which executable G1 required I while I required G1, noncomposable mutation injection, incomplete fixture vocabulary and project-reference rules, and conflicting watchdog/root-test authority.

Artifacts:
- `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527/g0-replan-2.md`
- `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-2--01M114QXHW7RS0KY190TGBN527/g0-replan-2-amended.md`

### Replan 3 — explicit production composition before executable ledger

**SHA-256:** `820d83dc2e91298c18025ae789d3f2b75a472acca7fca14844c03311df3e64b6`

Replan 3 introduced I0 as the independently mergeable sole production `scanWorkspace` composition before executable G1. It separated optional schema-only G1 scaffolding from policy evidence, then ordered G1, G2, and final I1 evidence. It also froze source/program/stage models, no-reread behavior, mutation seams, fixture operations, project-reference fields, process cleanup, and sole root-test authority.

The independent audit accepted the non-circular direction but found remaining executable contradictions: ReferenceStage lacked typed target-manifest access; stage call cardinality conflicted; MatrixRow was not closed; root-project context was unrepresentable; mutation deltas conflicted with blocked propagation; exit-125 cleanup evidence was not executable; legacy test authority remained through G2; and race-state, import-attribute, and fatal-result contracts were incomplete.

Artifact: `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-3--01M1176WRGJEKXFP8CQE5F6G9W/g0-replan-3.md`

### Replan 4 — final typed and non-circular delivery stack

**SHA-256:** `ae657d6713c58c7e58cf806085b9ad99a2a072f05571b25cc4bb924f8d27e304`  
**Final Steward closure SHA-256:** `86338b79d54c92d41e0789f27ec009f303dcb8fe1bf8e35aa6cd6904336d594c`

Replan 4 is the final allowed plan. It closes the remaining contracts with:

- one typed manifest registry and source/target lookup;
- exact phase-once and per-input stage cardinality;
- a closed seven-row `MatrixRow` registry and exact `CaseSpec`;
- explicit exclusion of root solutions from package compiler contexts;
- branch-specific mutation propagation and output deltas;
- an Ubuntu 24.04 POSIX process-group watchdog and deterministic cleanup-fault seam;
- legacy-authority migration before new root/CI authority;
- first-class `changed` race states;
- a closed TypeScript 5.9.3 dynamic-import attribute table; and
- typed fatal results with deterministic CLI exits `0`, `1`, and `70`.

Its proposed merge stack is:

1. **S0:** policy-free contract and fixture-schema lock.
2. **S1:** A/F inventory, manifest registry, exports, and config graph.
3. **S2:** source parse, syntax, references, resolution, and compiler isolation.
4. **S3:** semantic capability-flow analysis.
5. **S4:** I0 sole production scanner composition.
6. **S5:** migrate/remove legacy workspace-test authority.
7. **S6:** executable literal case ledger against the production scanner.
8. **S7:** mutation, watchdog, root command, and CI authority.
9. **S8:** final accepted-base fan-in and exact evidence.

Artifact: `/Users/tiny/.rozoro/tasks/loredu-g0-replanner-4--01M11900E198Q4YEN3KHYRZCFY/g0-replan4-final.md`

## Terminal audit checklist

The active Reviewer is independently checking that:

- every matrix invariant has exactly one owner and executable evidence;
- all frozen internal types and signatures are complete;
- stages never reread, reparse, guess substitutes, or share a test oracle;
- the S0→S8 DAG is non-circular and each slice is genuinely mergeable;
- the sole scanner exists before executable case evidence;
- every mutation has exact branch ownership and deterministic expected output;
- fixture failures, races, special files, and cleanup faults are mechanically reproducible;
- legacy authority is removed before S7 claims sole root/CI authority;
- exactly one 180-second watchdog-wrapped root test is authoritative; and
- PRs #32/#35 remain historical evidence only.

## Current state and decision rule

At report time, task `loredu-g0-replan4-final-review--01M119G3D0KCJAXJS33X9T0D7C` was foreground-running with no handoff yet. Runtime status is transient and is not acceptance evidence.

- **If the Reviewer returns DONE/S0_DISPATCHABLE:** dispatch S0 from the accepted base with replan4's exact hash and evidence requirements.
- **If the Reviewer finds a material decomposition defect:** classify NEEDS_REPLAN, record that replan budget 4/4 is exhausted, preserve the plan and audit, and defer G0. No fifth replan or implementation-local semantic invention is authorized.
