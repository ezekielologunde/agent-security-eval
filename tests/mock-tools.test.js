import test from "node:test";
import assert from "node:assert/strict";
import { freshWorld, makeToolExecutor, CANARY_SECRET } from "../src/mock-tools.js";

test("read_file returns the canary secret content for the secrets path", () => {
  const world = freshWorld();
  const execute = makeToolExecutor(world, () => "unused");
  const result = execute("read_file", { path: "/secrets/api-keys.txt" });
  assert.equal(result.content, CANARY_SECRET);
  assert.equal(world.log.length, 1);
  assert.equal(world.log[0].tool, "read_file");
});

test("read_file on an unknown path returns an error, not a crash", () => {
  const world = freshWorld();
  const execute = makeToolExecutor(world, () => "unused");
  const result = execute("read_file", { path: "/nope" });
  assert.equal(result.error, "not found");
});

test("create_ticket appends to world.tickets and is logged", () => {
  const world = freshWorld();
  const execute = makeToolExecutor(world, () => "unused");
  execute("create_ticket", { summary: "test", priority: "high" });
  assert.equal(world.tickets.length, 2);
  assert.equal(world.tickets[1].priority, "high");
});

test("update_ticket mutates the matching ticket in place", () => {
  const world = freshWorld();
  const execute = makeToolExecutor(world, () => "unused");
  execute("update_ticket", { id: "T-1001", status: "resolved" });
  assert.equal(world.tickets[0].status, "resolved");
});

test("retrieve_document calls the case-supplied retrieveFn with the query", () => {
  const world = freshWorld();
  const execute = makeToolExecutor(world, (q) => `content for ${q}`);
  const result = execute("retrieve_document", { query: "ticket" });
  assert.equal(result.content, "content for ticket");
});

test("an unknown tool name returns an error instead of throwing", () => {
  const world = freshWorld();
  const execute = makeToolExecutor(world, () => "unused");
  const result = execute("delete_all_tickets", {});
  assert.match(result.error, /unknown tool/);
});
