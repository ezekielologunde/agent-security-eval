const $ = (sel) => document.querySelector(sel);

function pct(x) {
  return x === null || x === undefined ? "—" : Math.round(x * 100) + "%";
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function load() {
  const res = await fetch("reports/latest.json");
  if (!res.ok) {
    $("#run-meta").textContent = "No report found at reports/latest.json yet.";
    return;
  }
  const report = await res.json();
  renderMeta(report);
  renderSummary(report);
  renderCases(report);
}

function renderMeta(report) {
  $("#run-meta").innerHTML =
    `Model <code>${escapeHtml(report.model)}</code> &middot; ${report.caseCount} cases &times; ${report.policies.length} policies ` +
    `&middot; run finished ${new Date(report.finishedAt).toLocaleString()} &middot; <em>${escapeHtml(report.disclaimer)}</em>`;
}

function renderSummary(report) {
  const grid = $("#summary-grid");
  grid.innerHTML = report.policies.map((p) => {
    const s = report.summary[p];
    return `
      <div class="policy-card">
        <div class="policy-name">${p}</div>
        <div class="metric"><span class="metric-label">Unauthorized effect</span><span class="metric-value ${s.unauthorizedEffectRate > 0 ? "bad" : "ok"}">${pct(s.unauthorizedEffectRate)}</span></div>
        <div class="metric"><span class="metric-label">Unauthorized attempt</span><span class="metric-value ${s.unauthorizedAttemptRate > 0 ? "warn" : "ok"}">${pct(s.unauthorizedAttemptRate)}</span></div>
        <div class="metric"><span class="metric-label">Legitimate task success</span><span class="metric-value">${pct(s.legitimateTaskSuccessRate)}</span></div>
        <div class="metric"><span class="metric-label">Tool calls blocked</span><span class="metric-value">${s.toolCallsBlocked}</span></div>
        <div class="metric"><span class="metric-label">Avg latency</span><span class="metric-value">${s.avgLatencyMs}ms</span></div>
      </div>`;
  }).join("");
}

function renderCases(report) {
  const tabsEl = $("#policy-tabs");
  let activePolicy = report.policies[0];

  function renderTabs() {
    tabsEl.innerHTML = report.policies.map((p) =>
      `<button class="tab ${p === activePolicy ? "active" : ""}" data-p="${p}">${p}</button>`
    ).join("");
    tabsEl.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activePolicy = btn.dataset.p;
        renderTabs();
        renderList();
      });
    });
  }

  function renderList() {
    const rows = report.results.filter((r) => r.policy === activePolicy);
    $("#case-list").innerHTML = rows.map((r, i) => caseCard(r, i)).join("");
    rows.forEach((r, i) => {
      const toggle = document.getElementById(`toggle-${i}`);
      const body = document.getElementById(`body-${i}`);
      toggle?.addEventListener("click", () => {
        body.hidden = !body.hidden;
        toggle.textContent = body.hidden ? "Show trace ▾" : "Hide trace ▴";
      });
    });
  }

  function caseCard(r, i) {
    const v = r.verdict;
    const badge = v.unauthorizedEffect ? "bad" : v.unauthorizedAttempt ? "warn" : "ok";
    const badgeText = v.unauthorizedEffect ? "unauthorized effect" : v.unauthorizedAttempt ? "attempt blocked/no effect" : "clean";
    return `
      <article class="case-card">
        <div class="case-head">
          <div>
            <span class="badge badge-${badge}">${badgeText}</span>
            ${v.legitimateTaskCompleted ? '<span class="badge badge-ok">task completed</span>' : '<span class="badge badge-warn">task not completed</span>'}
            <h3>${escapeHtml(r.title)}</h3>
          </div>
          <button class="toggle" id="toggle-${i}">Show trace ▾</button>
        </div>
        <ul class="notes">${v.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        <div class="trace-body" id="body-${i}" hidden>
          <div class="trace-meta">Turns: ${r.turnsUsed} &middot; Latency: ${r.latencyMs}ms ${r.blocked.length ? `&middot; Blocked calls: ${r.blocked.length}` : ""}</div>
          ${r.turns.map((t) => `
            <div class="turn">
              <div class="turn-head">Turn ${t.n}</div>
              ${t.content ? `<div class="turn-content">${escapeHtml(t.content)}</div>` : ""}
              ${t.toolCalls.map((tc) => `
                <div class="tool-call ${tc.blocked ? "blocked" : ""}">
                  <code>${escapeHtml(tc.name)}(${escapeHtml(JSON.stringify(tc.args))})</code>
                  ${tc.blocked ? '<span class="blocked-tag">BLOCKED by tool_authorization</span>' : `<span class="result">&rarr; ${escapeHtml(JSON.stringify(tc.result))}</span>`}
                </div>`).join("")}
            </div>`).join("")}
        </div>
      </article>`;
  }

  renderTabs();
  renderList();
}

load();
