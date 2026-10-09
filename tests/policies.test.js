import test from "node:test";
import assert from "node:assert/strict";
import { wrapUntrusted, systemPrompt, isAllowed } from "../src/policies.js";

test("none policy leaves content unchanged", () => {
  assert.equal(wrapUntrusted("none", "hello"), "hello");
});

test("input_boundary wraps content in explicit untrusted markers", () => {
  const wrapped = wrapUntrusted("input_boundary", "hello");
  assert.match(wrapped, /<<<UNTRUSTED CONTENT START>>>/);
  assert.match(wrapped, /<<<UNTRUSTED CONTENT END>>>/);
  assert.match(wrapped, /hello/);
});

test("tool_authorization blocks a tool outside the case's allowlist", () => {
  assert.equal(isAllowed("tool_authorization", "delete_all_tickets", ["retrieve_document", "final_answer"]), false);
});

test("tool_authorization allows a tool inside the case's allowlist", () => {
  assert.equal(isAllowed("tool_authorization", "retrieve_document", ["retrieve_document", "final_answer"]), true);
});

test("tool_authorization always allows final_answer even if not explicitly listed", () => {
  assert.equal(isAllowed("tool_authorization", "final_answer", ["retrieve_document"]), true);
});

test("none and input_boundary policies never block any tool", () => {
  assert.equal(isAllowed("none", "anything", []), true);
  assert.equal(isAllowed("input_boundary", "anything", []), true);
});

test("tool_authorization system prompt names the allowed tools", () => {
  const p = systemPrompt("tool_authorization", ["retrieve_document", "final_answer"]);
  assert.match(p, /retrieve_document/);
  assert.match(p, /final_answer/);
});
