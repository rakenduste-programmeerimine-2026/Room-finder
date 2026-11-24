---
name: prepare-pr
description: Prepare a Pull Request for the current feature branch, including the required checks and reviews. Use when a unit of work is finished and ready for team review.
---

# Prepare a Pull Request

Merging and approval are left to the team. Never comment on or review other people's Pull Requests. Prepare the Pull Request, ask the user for permission to open it, and stop. Never approve a Pull Request, including your own.

## 1. Confirm the work

- The GitHub Issue for this work exists and its scope is complete.
- Commits follow the Angular convention, are bundled by logical type at about 50 to 150 changed lines each, and reference the issue.
- Only the files of the user's role and the shared files are changed, unless the user explicitly allowed more (Team scope in `CLAUDE.md`). Another role's part is a stub marked `PLACEHOLDER(#issue)` with contract tests.
- Times are stored and computed in UTC; local time appears only in the user interface.
- No secrets are committed: no `.env` files, no secret or `service_role` key.
- Code for common cross-domain tasks and every new dependency has a `library-auditor` result.
- No heavy technology (headless browsers, WebAssembly, native modules, workers, new infrastructure) without the user's recorded approval.
- Any `PLACEHOLDER(#issue)` has a matching backlog item.
- Every bug fixed on this branch is logged in `docs/bugs/README.md`, and any implicit state machine involved is documented in `docs/automata/`.
- Supabase changes such as migrations, seed data and `supabase/config.toml` are committed.

## 2. Run the checks

Run all of these and fix any failures:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
```

`npm test` includes the database tests in `tests/db/`, which run on PGlite. Integration tests in `tests/integration/` need local Supabase (`npx supabase start`) and CI skips them, so they must pass here; run them once the `test:integration` script exists. Check that tests cover equivalence partitions and boundary values, including character length, time boundaries and similar constraints where useful.

## 3. Confirm the reviews

- Server code or compute-heavy code: the `performance-analyst` agent has run and its recommendation was followed.
- All code changes: run the `prompt-compliance-reviewer` agent. Fix any deviations, or report them to the user.
- For every review that did not run, note why it was not needed.

## 4. Open the Pull Request

Push the feature branch. Show the user the title and body and ask for permission. Only after they agree, open the Pull Request against `main`:

```bash
gh pr create --base main --title "<Angular-format title>" --body "<body>"
```

Use this body:

```markdown
Closes #<issue>

## Summary

## Tests and checks
- [ ] Automated tests, including database tests
- [ ] Type checking
- [ ] Linting
- [ ] Production build
- [ ] Integration tests

## Reviews
- Prompt compliance: <verdict>
- Performance analysis: <recommendation, or why not needed>
- Library audit: <recommendation, or why not needed>

## Decisions

## Unconfirmed decisions

## Open questions
| Question | Working assumption |
|---|---|

## Migrations
<none, or: apply with `npm run db:push` before merging, because merging deploys>

## Placeholders and known limitations
```

Tick only what actually passed. The Pull Request needs a review from at least one other team member. Report the Pull Request link and anything the user needs to decide.
