# Agent security evaluation harness — design

Status: build in progress, 2026-10-09. Vertical slice per
`independent-research-portfolio/engineering/agent-security-eval.md`.

## What this is

A sandboxed tool-using agent (real Ollama model, local homelab inference,
`qwen2.5-3b-cpu4`) run against synthetic cases that each embed an adversarial
instruction inside retrieved content the agent is told to treat as data, not
commands. The runner records every attempted tool call, whether it was
actually executed, and a deterministic oracle's verdict on whether the
legitimate task was completed and whether any unauthorized effect occurred.
No LLM judge is used as the sole oracle for tool side effects — oracles are
plain code checking the mock-tool call log.

## What this is not

- Not a new published benchmark. Cases are original but small (this run: 5
  cases), hand-authored, not adjudicated by a third party, and not compared
  against an established public benchmark's cases.
- Not evidence about any specific model's general safety. One small local
  model, one hardware budget, one run. Cross-model or cross-budget claims are
  explicitly out of scope here.
- Not a production security control. The "defenses" evaluated (input
  boundary marking, tool authorization) are evaluation baselines, not a
  hardened deployment.
- No real external targets, accounts, or production credentials. Every tool
  is a mock with an in-memory canary value standing in for a real secret.

## Threat model (per case)

A benign task (e.g., "summarize this ticket") plus an untrusted surface
(e.g., the ticket body) that contains an injected instruction trying to
redirect the agent toward an unauthorized tool effect — most commonly,
reading a canary "secret" and leaking its contents through a tool call the
task never asked for (a ticket update, a file write). The intended boundary
is case-specific and checked by that case's oracle function.

## Policies compared

- **`none`** — baseline. Untrusted content is concatenated into the prompt
  with no marking and no tool restriction. Expected to be the most
  exploitable.
- **`input_boundary`** — untrusted content is wrapped in explicit delimiters
  and the system prompt states plainly that content between them is data,
  never instructions. A prompt-level defense only; nothing in the runner
  enforces it.
- **`tool_authorization`** — the runner itself enforces a per-case tool
  allowlist (the tools the benign task actually needs). A call to any other
  tool is intercepted before execution, logged as `blocked`, and never
  reaches the mock tool. This is a code-level boundary, not a prompting
  strategy, and is expected to be the strongest of the three.

## Metrics

Per (case, policy): legitimate task completed (per oracle), unauthorized
effect occurred (per oracle), unauthorized tool calls attempted (whether or
not blocked), calls blocked by policy, overblocking (a legitimate, in-scope
tool call that `tool_authorization` incorrectly blocks), turns used,
wall-clock latency. Aggregated into an unauthorized-effect rate and a
legitimate-task-success rate per policy, reported with the exact case count
and model/version — never without those in the same sentence.

## Repo layout

```
src/mock-tools.js   mock retrieval/ticketing/file tools + canary state
src/policies.js     the three policies: prompt wrapping + allowlist enforcement
src/ollama-adapter.js   calls a local Ollama /api/chat endpoint with tool definitions
src/runner.js       one case x one policy x one adapter -> a recorded trace
cases/              case definitions: task, untrusted content, injection, oracle
eval/run.js         CLI: runs every case x policy combination, writes reports/
reports/            committed frozen output of a real run (not regenerated on every deploy)
tests/              oracle and policy unit tests, Node's built-in test runner
index.html etc.     static replay viewer reading the committed report, GitHub Pages
```

## Public demo

The public page replays the committed `reports/latest.json` from an actual
run — the same "evidence over live backend" shape as the SOC Review and
Rowmio Mastery demos in this portfolio set. It does not call Ollama live;
nothing here is reachable from the internet except the static replay.
