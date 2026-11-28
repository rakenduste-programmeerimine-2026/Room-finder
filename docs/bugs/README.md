# Bug log

Every fixed bug, newest first. Follow the `fix-bug` skill to add one. Dates are in UTC.

## Types

| Type | Meaning |
|---|---|
| implicit-state-machine | State spread across flags, fields or columns allowed an invalid combination |
| logic | Wrong condition, calculation or branch |
| time | Time zone, daylight saving or date boundary handled wrongly |
| concurrency | Race condition, ordering or stale data |
| validation | Bad input accepted or good input rejected, including boundaries |
| integration | Mismatch with another layer, service or dependency, such as ASIO |
| database | Schema, migration, query or Supabase policy problem |
| configuration | Environment, build or tooling settings |
| ui | Layout, styling or interaction problem |
| performance | Too slow or too much memory or CPU |
| security | Exposure of data or access |

## Log

| Date | Type | Description | Fix | Issue | State machine |
|---|---|---|---|---|---|
| 2026-11-28 | logic | In the curriculum group editor, a place filter chosen on one degree level tab stayed set on the next tab, which lists other values, so the list could be empty while the dropdown showed "Kõik"; found by the prompt-compliance-reviewer before the first commit. | Changing the tab clears the place filters (`selectLevel` in `curriculum-group-editor.tsx`); a component test reproduces it. Not an implicit state machine: one record of independent filters, whose tab change missed the reset. | #32 | – |
| 2026-11-27 | integration | Wrapping the new search form in React's `<Activity>`, to keep its inputs while the room group editor is open, froze the page in Chrome right after loading; found in the browser check before the first commit, while the jsdom tests passed. | The form is hidden with the `hidden` attribute instead, which also keeps every input; the comment in `search-form.tsx` warns against `<Activity>`. Isolated by removing parts of the page one at a time in the dev server; the cause inside React or Next.js was not identified. No automated test: jsdom does not reproduce it. | #25 | – |
