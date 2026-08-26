---
name: decision_application_core_first
description: "Choose a surface- and provider-agnostic Loredu application core before CLI, agent, crawler, or model integrations."
type: decision
tags: [decisions, architecture, core]
status: draft
generated: "ChatGPT GPT-5.6 Sol, 2026-08-26"
created_at: 2026-08-26T12:10:00+08:00
updated_at: 2026-08-26T12:10:00+08:00
---

# 0001: Application core first

## Context

Loredu is expected to be used by several kinds of activities and may later be one arm of a larger orchestration system. Starting from a CLI, crawler, model SDK, or source system would risk making those concerns part of the domain.

## Options considered

- design and implement a CLI as the product boundary first;
- center the product on an agent/model runtime;
- define language-neutral domain/application capabilities and add surfaces through adapters.

## Choice

Define the application/domain core first. CLI, web/API, agent, crawler, orchestration, model, and source-system integration are inbound or outbound adapters.

## Consequences

- v0.x contracts do not commit to CLI commands;
- the implementation language remains a separate decision;
- extractor and resolver ports do not assume a particular AI provider;
- provider-native types do not leak into core contracts;
- Loredu must remain usable without an LLM or orchestration runtime.

## Rule or follow-up

New capabilities belong in the core only when they maintain or expose accumulated operational knowledge rather than perform the external activity that produces or consumes it.
