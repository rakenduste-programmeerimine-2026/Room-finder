---
name: fix-bug
description: Fix a bug and log it. Use whenever a bug is found or fixed, including bugs found while working on something else.
---

# Fix a bug

## 1. Reproduce

1. If the bug has no GitHub Issue, check `gh issue list` for one first, so no duplicate is created. If none fits, create one with `gh issue create` and the `bug` label.
2. Write a failing test that reproduces it. Tests run with `TZ=UTC`; for a time bug, also cover the boundaries around it (midnight, day and week edges, daylight saving changes where local time is shown).

## 2. Find the cause

Check whether the cause is an implicit state machine. Signs include:

- Several booleans or flags that together encode a mode.
- Status strings or enums compared in many places.
- Nullable fields or columns used to mean "not started" or "done".
- Behaviour that depends on the order effects run in.
- Combinations of values that should be impossible but are reachable.

## 3. Fix

Make the smallest fix that makes the test pass, then run the relevant checks. If the fix touches another role's files, describe it in the issue and leave it to that role (Team scope in `CLAUDE.md`).

If the cause is an implicit state machine:

1. Run the `state-machine-analyst` agent on it.
2. Document the state machine in `docs/automata/<system>.md` with the `finite-automata` skill, marked as implicit, whatever the recommendation.
3. If the agent recommends making it explicit, show the user the recommendation and ask for the go-ahead. Do not refactor without it. If approved, do the refactor as its own issue and commits.

## 4. Log it

Add a row at the top of the table in `docs/bugs/README.md`:

- **Date:** in UTC.
- **Type:** one of the types listed in that file.
- **Description:** what went wrong, in one sentence, and how it was found.
- **Fix:** what was changed and the tool or technique used to find and fix it.
- **Issue:** the issue number.
- **State machine:** a link to the automaton file, or a dash.

Commit the fix, test and log together as `fix(<scope>): <subject>` with `Closes #<issue>`.
