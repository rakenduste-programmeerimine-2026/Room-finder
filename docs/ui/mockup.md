# Mockup

Status: proposal for issue #17, waiting for team approval. Nothing in `src/app/` is built from it until the team approves it.

Figma file: [Ruumileidja – mockup ja kasutajateekond](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6). Desktop frames, 1440 px wide, Estonian UI, font Geist (the app font in `src/app/layout.tsx`). Colours are Figma variables that map to Tailwind tokens.

The user journey that connects the screens is in [`docs/automata/search-journey.md`](../automata/search-journey.md), and its user stories are in [`docs/user-stories.md`](../user-stories.md). "Data model" below means `docs/data-model.md` in PR #35, which is not merged yet.

## Screens

| Frame | Screen | Requirement |
|---|---|---|
| [01](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=4-2) | New search: event, room group, complexity weights, days and time ranges, curricula, summary | 1, 1.1, 1.2, 1.3 |
| [02](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=5-152) | Room group editor: search by code and name variants, rank, save, save under a new name | 1, 1.1 |
| [03](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=5-372) | Time windows: next-semester warning (banner and toast), invalid ranges, date picker | 1.2, 0 |
| [04](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=5-560) | CSV upload: drop zone, accepted and rejected file, format help, use together with manual times | 1.4 |
| [05](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=5-660) | Curricula and courses: ASIO-like list by degree level, ranked group, course choice, save under a new name | 1.3 |
| [06](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=5-927) | Loading screen while the backend works | 0 |
| [07](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=5-964) | Result: best time and room, groups it does not suit, booking hint | 3 |
| [08](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=5-1080) | States: event types by popularity with "add new type", toasts, missing required inputs, no result | 0, 1.1, 3 |

All room codes, course codes and counts in the frames are illustrative, not ASIO data.

## Design choices

All of these are unconfirmed decisions by the frontend role (listed in #17).

- **One page for all inputs.** The idea description (idea 2, agreed acceptance condition) has the organiser choose options from a dropdown during a meeting, so every input is visible at once. The editors for room and curriculum groups are separate views because they are used before the meeting.
- **Saved groups first.** Each section starts with a dropdown of saved groups; "Muuda gruppi" and "+ Uus grupp" open the editor.
- **Times in Europe/Tallinn, sent in UTC.** Every time on screen is local time; the UI converts at the boundary and says so next to the inputs (team rule "Kasutame ainult UTC aega!!!", #17).
- **Warnings and errors are toasts** (react-toastify, team rule point 0). The next-semester warning is also kept as a banner in the time section, so it stays visible after the toast closes.
- **Complexity weights belong to the search**, not to a room group, as in the data model (`searches.complexity_weights`).

## Questions for the other roles

Raised here; to be added to the issues named in the Owner column with the frontend member's permission. Until answered, the UI uses the working assumption.

| # | Question | Working assumption | Owner |
|---|---|---|---|
| UI-1 | ASIO groups are per study year (`IFIFB-1`, `IFIFB-2`). The data model's curriculum item has no year. Where is the year stored? | `asio_id` holds the ASIO group code, e.g. `IFIFB-1` | Database, backend (#28, #30) |
| UI-2 | Can the UI know the next-semester start date S before the search runs, to warn while the user picks days? | S is a local date from the backend or a constant, `PLACEHOLDER(#20)` | Backend (#20) |
| UI-3 | Does the search run asynchronously, and how does the UI follow it (polling `searches.status`, Realtime, or one long request)? | Polling every 2 s, giving up after 2 minutes | Backend (#23) |
| UI-4 | The data model has an optional `course` per unsuitable group (5.5). Will the matching fill it? Frame 07 shows the course name. | `course` per unsuitable group, as in 5.5 | Backend (#22, #23) |
| UI-5 | CSV times in UTC (data model Q2) are hard to write by hand. Could the CSV use local time? | UTC as in the data model; the help text shows the conversion | Backend (#31) |
| UI-6 | Which ASIO link opens a room's calendar from the result? | Link hidden until the URL pattern is known | Backend (#21) |
| UI-7 | Mockup room codes look like real buildings (A-543). The seed uses `DEMO-` codes. | Switch the frames to `DEMO-` codes in the next Figma pass | Frontend |
| UI-8 | Is there a call that checks a CSV and returns row errors and the parsed time windows before the search is created? `searches.time_windows` is required on insert. | Yes, a separate check call | Backend (#31) |
| UI-9 | #23 says 1.2 is always required, #33 says the CSV may replace 1.2. Is a search with only a CSV valid? | Yes, an accepted CSV counts as 1.2 (data model section 2) | Backend (#23, #31) |
| UI-10 | Is a time range shorter than the event duration invalid in the UI, or left to the matching? | Invalid in the UI | Backend (#20, #22) |

## Not in the mockup

- Mobile layout: the main use is a laptop during a meeting. Working assumption: below 1024 px the columns stack.
- A list of earlier searches: not in the task; the data model keeps searches, so it can be added later.
- Prototype links between frames and a Figma journey page: the Figma Starter plan's tool-call limit was reached; the journey is documented in Markdown instead.
