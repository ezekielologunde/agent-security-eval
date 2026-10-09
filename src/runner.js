import { TOOL_DEFS, freshWorld, makeToolExecutor } from "./mock-tools.js";
import { wrapUntrusted, systemPrompt, isAllowed } from "./policies.js";
import { chat } from "./ollama-adapter.js";

const MAX_TURNS = 6;

// Runs one (case, policy) pair through the real agent loop against the configured
// adapter and returns a full trace plus the oracle's verdict. No LLM judge: the oracle
// is `caseDef.oracle(world, trace)`, plain code over the mock-tool call log.
export async function runCase(caseDef, policy) {
  const world = freshWorld();
  const retrieveFn = (query) => wrapUntrusted(policy, caseDef.retrieve(query));
  const execute = makeToolExecutor(world, retrieveFn);

  const messages = [
    { role: "system", content: systemPrompt(policy, caseDef.allowedTools) },
    { role: "user", content: caseDef.task },
  ];

  const trace = { case: caseDef.id, policy, turns: [], blocked: [], startedAt: new Date().toISOString() };
  let turns = 0;
  let finished = false;
  const start = Date.now();

  while (turns < MAX_TURNS && !finished) {
    turns++;
    let result;
    try {
      result = await chat(messages, TOOL_DEFS);
    } catch (err) {
      trace.error = String(err);
      break;
    }
    const turnRecord = { n: turns, content: result.content, toolCalls: [] };

    if (result.toolCalls.length === 0) {
      // Model answered in free text without calling final_answer; treat as done.
      messages.push({ role: "assistant", content: result.content });
      turnRecord.note = "no tool call, treated as implicit stop";
      trace.turns.push(turnRecord);
      finished = true;
      break;
    }

    messages.push({ role: "assistant", content: result.content, tool_calls: result.toolCalls.map((tc) => ({ function: { name: tc.name, arguments: tc.args } })) });

    for (const call of result.toolCalls) {
      const allowed = isAllowed(policy, call.name, caseDef.allowedTools);
      if (!allowed) {
        trace.blocked.push({ turn: turns, tool: call.name, args: call.args });
        turnRecord.toolCalls.push({ name: call.name, args: call.args, blocked: true });
        messages.push({ role: "tool", content: JSON.stringify({ error: "blocked by tool_authorization policy: not in allowlist for this task" }) });
        continue;
      }
      const toolResult = execute(call.name, call.args);
      turnRecord.toolCalls.push({ name: call.name, args: call.args, blocked: false, result: toolResult });
      messages.push({ role: "tool", content: JSON.stringify(toolResult) });
      if (call.name === "final_answer") finished = true;
    }
    trace.turns.push(turnRecord);
  }

  trace.latencyMs = Date.now() - start;
  trace.turnsUsed = turns;
  trace.world = world;
  trace.finished = finished;

  const verdict = caseDef.oracle(world, trace);
  trace.verdict = verdict;
  return trace;
}
