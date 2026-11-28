import { describe, expect, it } from "vitest";
import type { SearchResult, SearchStatus } from "@/app/_ports/ports";
import { COMPOSING, nextRun, type SearchEvent, type SearchRun } from "./search-run";

const best = { roomCode: "DEMO-101", start: "2026-12-01T12:00:00Z", end: "2026-12-01T13:30:00Z", score: 1 };
const found: SearchResult = { best, unsuitableGroups: [], warnings: [] };
const nothing: SearchResult = { best: null, unsuitableGroups: [], warnings: [] };

const submitting: SearchRun = { state: "submitting" };
const pending: SearchRun = { state: "waiting", id: "a", status: "pending" };
const running: SearchRun = { state: "waiting", id: "a", status: "running" };
const result: SearchRun = { state: "result", id: "a", best, result: found };
const noResult: SearchRun = { state: "no_result", id: "a", result: nothing };

const status = (s: SearchStatus, id = "a"): SearchEvent => ({ type: "status", id, status: s });

describe("nextRun", () => {
  it.each<[string, SearchRun, SearchEvent, SearchRun]>([
    ["the button starts sending", COMPOSING, { type: "submit" }, submitting],
    ["a created search is waited for", submitting, { type: "created", id: "a" }, pending],
    ["a failed request goes back to the form", submitting, { type: "start_failed" }, COMPOSING],
    ["a running search keeps the screen", pending, status({ status: "running" }), running],
    ["a found time shows the result", running, status({ status: "done", result: found }), result],
    ["no time shows the empty result", pending, status({ status: "done", result: nothing }), noResult],
    ["a failed search goes back to the form", running, status({ status: "failed", error: "ASIO" }), COMPOSING],
    ["two minutes without an answer go back", running, { type: "timeout", id: "a" }, COMPOSING],
    ["stop waiting", running, { type: "back" }, COMPOSING],
    ["stop while sending", submitting, { type: "back" }, COMPOSING],
    ["change the inputs after a result", result, { type: "back" }, COMPOSING],
    ["change the inputs after no result", noResult, { type: "back" }, COMPOSING],
  ])("%s", (_, from, event, to) => {
    expect(nextRun(from, event)).toEqual(to);
  });

  it.each<[string, SearchRun, SearchEvent]>([
    ["a second press of the button", submitting, { type: "submit" }],
    ["a press while waiting", running, { type: "submit" }],
    ["an id after the user stopped waiting", COMPOSING, { type: "created", id: "a" }],
    ["a late failure of the start", COMPOSING, { type: "start_failed" }],
    ["the status of a search the user stopped waiting for", COMPOSING, status({ status: "done", result: found })],
    ["the status of another search", running, status({ status: "done", result: found }, "b")],
    ["the same status again", running, status({ status: "running" })],
    ["a status after the result", result, status({ status: "failed", error: "x" })],
    ["the time limit of another search", running, { type: "timeout", id: "b" }],
    ["the time limit after the result", result, { type: "timeout", id: "a" }],
    ["back on the form", COMPOSING, { type: "back" }],
  ])("ignores %s", (_, from, event) => {
    expect(nextRun(from, event)).toBe(from);
  });
});
