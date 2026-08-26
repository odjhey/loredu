---
name: decision_contract_driven_work_protocol
description: "Makes contract matrices, invariant classification, evidence mapping, and explicit escalation mandatory for work touching domain contracts."
type: decision
tags: [decisions, ai, agents, policy, contracts]
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T19:44:20+08:00
---

# 0022: Contract-driven work protocol

## Context

Loredu's contracts are normative, but a task can still pass broad repository checks while omitting an invariant or accepting behavior outside the contract. Parallel work makes that risk larger: a generic implementation shortcut or an unstated public choice can propagate before another worker sees the mismatch.

The existing agent policy requires durable decisions and domain-document closure, but it does not require each contract-touching work item to enumerate, classify, and evidence all governing invariants. Operator authority has settled the protocol that closes that process gap.

## Options considered

1. Leave invariant discovery to each task's implementation and review process.
2. Publish the protocol only in a temporary task plan.
3. Make the protocol mandatory in the authoritative human and machine-readable agent policies, with a root entry-point link.

## Choice

Choose option 3. Any work touching a domain contract follows the twelve-step [Contract-driven work protocol](../ai/agent-policy.md#contract-driven-work-protocol).

The work item must identify governing contracts, ADRs, and catalog rows; enumerate and classify every normative invariant in a Contract Matrix; and eventually attach implementation and suitable test/review evidence to every in-scope invariant. Broader-than-contract behavior is a bug, and narrower behavior is a bug unless the contract explicitly permits it. Helpers may not erase contract-required semantic distinctions.

A new public semantic, API, persisted-shape, or ownership choice is reported as `NEEDS_DECISION`, not silently implemented. A decomposition mismatch is reported as `NEEDS_REPLAN`. Green CI is evidence only for its actual assertions, and findings return to Watchtower rather than implicitly authorizing successor work.

The human-readable policy contains the authoritative wording. Its YAML companion mirrors the mandatory obligations in the established structured style, and `AGENTS.md` points fresh workers to the full protocol.

## Consequences

- Contract-touching tasks carry explicit scope and evidence accounting before they can claim completion.
- Reviews can detect both accidentally broad acceptance and accidental narrowing instead of treating green CI as complete proof.
- Public choices and stale task decomposition become visible escalation outcomes.
- This is an operational policy change only. It changes no domain term, domain contract, behavioral catalog row, public API, or persisted shape, so the domain-doc update playbook requires no architecture or contract edit.

## Rule / follow-up

Keep `AGENTS.md`, `docs/ai/agent-policy.md`, and `docs/ai/agent-policy.yaml` equivalent whenever this protocol changes. Supersede this decision rather than weakening or extending the protocol silently.
