# Project rules

Room-finder (Ruumileidja) helps Tallinn University event organisers find the best time and room for an event. Users rank room groups, enter possible days and time ranges (or upload them as CSV), and may pick curricula or courses whose classes the event must not overlap. The app collects room bookings from ASIO and proposes the best time and room.

The primary goal is the smallest maintainable codebase: easy to understand, test, extend and maintain.

Requirements live in this file and in GitHub issues. This file holds the standing team rules; an issue holds the requirements and decisions for its unit of work. If they disagree, ask the user and report the difference.

## Standing rules

These apply to the main session, every agent and every skill. Agents read this section and the issue they work on (`gh issue view <number>`) before they start.

1. **Requirements:** this file and the issue are the source of truth. Record new requirements, approved decisions and answers to clarifying questions, quoted exactly, in the description of the issue or Pull Request, under "Decisions". A lasting team rule goes in this file through a Pull Request. Never silently override an earlier requirement; ask first.
2. **Pull Requests:** never open one without the user's permission. Never approve or merge one, including your own. Never comment on, review or act on other people's Pull Requests; report findings about them to the user only. Comment on issues and Pull Requests only with the user's permission.
3. **Branches:** never push directly to `main`.
4. **Commits:** bundle by logical type, about 50 to 150 changed lines each, Angular convention, linked to an issue.
5. **Team scope:** change only the files of the user's role and the shared files without explicit permission. See Team scope.
6. **Heavy technology:** headless browsers, WebAssembly, native modules, worker threads, Web Workers, external solver services and new infrastructure such as job queues need a `performance-analyst` justification and the user's explicit approval before they are added.
7. **Library audit:** before writing code for a common, cross-domain task (CSV parsing, HTML scraping, date and time zone handling, scheduling or optimisation), run the `library-auditor` agent. Small, project-specific logic needs no audit.
8. **Bugs:** follow the `fix-bug` skill and log every fix. Ask for the go-ahead before refactoring an implicit state machine, and document it either way.
9. **Large changes:** build the result and show it to the user first. Split it into commits, create follow-up issues and prepare the Pull Request only after the user's go-ahead.
10. **Claude's own decisions:** record every decision the user has not confirmed in the description of the issue or Pull Request, under "Unconfirmed decisions". It stands until the user says otherwise. Chosen thresholds and constants are open to change.

## Stack

Use the latest stable versions.

- Framework: Next.js (App Router), following Next.js conventions. There is no separate Express.js server.
- Backend: Next.js server code, meaning Route Handlers, Server Actions, the ASIO scraper, the time and room matching, and Supabase data access.
- Use ports and adapters wherever they do not clash with Next.js, in both the frontend and the server code. If unsure, run the `architecture-reviewer` agent and follow its verdict.
- Language: TypeScript, including automated tests.
- Styling: Tailwind CSS.
- Database and auth: Supabase (Postgres, row level security, anonymous sign-in).
- Hosting: Vercel.

## Domain rules

- **UTC only.** Store times as `timestamptz`, compute in UTC, and run tests and CI with `TZ=UTC`. Local time (Europe/Tallinn) appears only in the user interface; convert at that boundary.
- **No user accounts.** Users are identified by Supabase anonymous sign-in (`ensureAnonymousSession` in `src/lib/supabase/`). Restrict data access with row level security on `auth.uid()`.

## Architecture

- Keep UI, server code and database independent, with clearly defined interfaces and responsibilities.
- Avoid unnecessary coupling between layers.
- Local Supabase (`npx supabase start`) is for development and integration tests. A hosted Supabase project serves Vercel preview and production. All Supabase code goes in GitHub: `supabase/config.toml`, migrations, seed data and database tests.
- Never commit `.env` files, keys or other secrets. `.env.local` holds only the publishable key; a secret or `service_role` key never goes in the repository or in client code.
- If work needs another role's part, do not write it. Define the interface (port), use a stub adapter marked `PLACEHOLDER(#issue)`, write contract tests the real adapter must pass, and create the issue for the owning role.
- If an integration or dependency is not available yet, use a dummy value, mark it in code with `PLACEHOLDER(#issue)`, and create the backlog item.
- Try anything you are unsure can be built in `experiments/`, which is git-ignored. Share the results as a summary. Code from a successful experiment that belongs to another role is shared clearly marked as an unverified prototype, for that role to verify and test before it is integrated.
- If a new prompt cannot reasonably fit the established architecture or principles, ask for clarification and approval.

## Workflow for every prompt that changes code

1. **Check for conflicts.** Run the `prompt-conflict-reviewer` agent before changing code. If it finds a conflict, explain it and get explicit confirmation before implementing. Never silently override an earlier requirement.
2. **Find or create the GitHub Issue.** Check `gh issue list` for an existing issue first, so no duplicates are created. If none fits, create one with `gh issue create`. Then create a feature branch for it from `main`.
3. **Record decisions.** Add new requirements, approved decisions and answers to clarifying questions to the issue description under "Decisions", quoted exactly, or to the Pull Request description when it is prepared (Standing rule 1). Do not record prompts as comments.
4. **Audit libraries.** Before code for a common, cross-domain task, run the `library-auditor` agent. Ask the user about anything it flags.
5. **Analyze performance.** Before new server code or compute-heavy code, such as the ASIO scraper or the time and room matching, run the `performance-analyst` agent.
6. **Implement and test.** Testing is part of development, not a final step. Check user interface changes in the browser before committing.
7. **Check compliance.** After code changes, run the `prompt-compliance-reviewer` agent and report any deviations.
8. **Prepare the Pull Request** with the `prepare-pr` skill. Ask the user before opening it. Merging is left to the team.

## Bugs

Whenever you fix a bug, follow the `fix-bug` skill and log the bug type, a short description and what fixed it in `docs/bugs/README.md`.

If the bug comes from an implicit state machine:

- Run the `state-machine-analyst` agent to decide whether it should be made explicit in code and refactored.
- Ask the user for the go-ahead before any such refactor.
- Document the state machine in `docs/automata/` either way, even if it stays implicit.

Document every implicit state machine you find, not only ones that caused a bug.

## Git

- Never push directly to `main`. Never merge Pull Requests.
- Use a feature branch for all development work, named `<type>/<issue>-<short-description>`, for example `feat/12-room-groups`.
- Pull Requests target `main` and need a review from at least one other team member. Nobody merges their own Pull Request.
- Commit messages follow the Angular convention: `type(scope): subject`, with `Refs #123` or `Closes #123` in the footer.
- Commit size and Pull Request permission: see Standing rules 2 and 4. A single file larger than 150 lines may be one commit.
- Development, integration, release preparation and production deployment are distinct stages. A push to `main` deploys to production after CI passes, so merging is deploying. Use the `release` skill for releases.

## Team scope

This is a team project with three roles. Each team member declares their role in their personal `~/.claude/CLAUDE.md`. If no role is declared, ask the user for it before changing code.

| Role | Owns |
|---|---|
| Database & quality | `supabase/` (schema, migrations, policies, seed data), `src/lib/supabase/`, `src/proxy.ts`, `tests/db/`, `.github/workflows/`, CI and the Vercel setup |
| Backend | The ASIO scraper, the time and room matching, Route Handlers, Server Actions and data access built on `src/lib/supabase/` |
| Frontend | Pages, layouts and components in `src/app/` (Route Handlers and Server Actions excepted), styles and client-side logic |

- Shared files (`package.json`, `CLAUDE.md`, `.claude/`, `README.md`, `docs/` and tooling config) may be changed by any role, through a Pull Request.
- Tests belong to the role that owns the code they test.
- Without the user's explicit permission, change only the user's role's files and the shared files.
- If work needs another role's change, describe what is needed in the issue or Pull Request and leave it to that role (see Architecture for stubs and placeholders).

## Database and production

- Manage schema changes only through version-controlled migrations in `supabase/migrations/`.
- Verify migrations locally with `npx supabase db reset` and the database tests before they are applied to the hosted project.
- Apply migrations to the hosted project with `npm run db:push` before the Pull Request that needs them is merged, because merging deploys. Only the database & quality role does this, or someone with that role's explicit permission.
- Never make undocumented direct changes to production, including in the Supabase dashboard.

## Testing

- A change is not complete merely because it compiles.
- Before merging or releasing, run automated tests, type checking, linting, the production build, integration tests and database tests.
- Unit tests and database tests (`tests/db/`, on PGlite) run in `npm test`. CI runs them with linting, type checking and the build on every push. PGlite and `tests/db/` are added with the first database tests.
- Integration tests (`tests/integration/`) need local Supabase and CI skips them, so run `npm run test:integration` locally before every Pull Request, once that script exists. It is added with the first integration test.
- All tests run with `TZ=UTC`. Cover time boundaries: midnight, day and week edges, and daylight saving changes wherever local time is shown.
- Use equivalence partitioning and boundary-value analysis, including character length and similar constraints where useful.

## Performance

Prefer simple TypeScript implementations and existing platform APIs. Heavy technology needs a `performance-analyst` justification and the user's approval (Standing rule 6).

## Planning and documentation

- Every significant development task has an issue. Keep the backlog, timeline and Kanban board synchronized with the `project-planning` skill.
- Document systems as finite automata where possible, with the `finite-automata` skill. User stories built from them go in `docs/user-stories.md`.
- Aggressively separate documented system behaviour, at any level of abstraction, into independent audit, quoted requirement (from an issue or this file), and your own understanding.
- Do not leave unfinished integrations or dependencies undocumented. Anything that must be created, configured or connected outside this project goes in all relevant planning structures.
