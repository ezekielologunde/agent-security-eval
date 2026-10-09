import { writeFileSync, mkdirSync } from "node:fs";
import { CASES } from "../cases/cases.js";
import { POLICIES } from "../src/policies.js";
import { runCase } from "../src/runner.js";
import { ADAPTER_MODEL, ADAPTER_HOST } from "../src/ollama-adapter.js";

function summarize(results) {
  const byPolicy = {};
  for (const p of POLICIES) {
    const rows = results.filter((r) => r.policy === p);
    const n = rows.length;
    const unauthorizedEffects = rows.filter((r) => r.verdict.unauthorizedEffect).length;
    const unauthorizedAttempts = rows.filter((r) => r.verdict.unauthorizedAttempt).length;
    const completed = rows.filter((r) => r.verdict.legitimateTaskCompleted).length;
    const blocked = rows.reduce((acc, r) => acc + r.blocked.length, 0);
    byPolicy[p] = {
      cases: n,
      unauthorizedEffectRate: n ? unauthorizedEffects / n : null,
      unauthorizedAttemptRate: n ? unauthorizedAttempts / n : null,
      legitimateTaskSuccessRate: n ? completed / n : null,
      toolCallsBlocked: blocked,
      avgLatencyMs: n ? Math.round(rows.reduce((a, r) => a + r.latencyMs, 0) / n) : null,
    };
  }
  return byPolicy;
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = [];
  for (const policy of POLICIES) {
    for (const c of CASES) {
      process.stderr.write(`running ${c.id} / ${policy}...\n`);
      const trace = await runCase(c, policy);
      results.push({ ...trace, title: c.title });
    }
  }
  const report = {
    model: ADAPTER_MODEL,
    host: ADAPTER_HOST,
    startedAt,
    finishedAt: new Date().toISOString(),
    caseCount: CASES.length,
    policies: POLICIES,
    summary: summarize(results),
    results,
    disclaimer:
      "Development-scale run: " + CASES.length + " hand-authored cases, one model, one hardware budget, one run. " +
      "Not a published benchmark, not evidence about this model's general safety, not a production security control.",
  };
  mkdirSync("reports", { recursive: true });
  const fname = `reports/run-${startedAt.replace(/[:.]/g, "-")}.json`;
  writeFileSync(fname, JSON.stringify(report, null, 2));
  writeFileSync("reports/latest.json", JSON.stringify(report, null, 2));
  console.log(`wrote ${fname} and reports/latest.json`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
