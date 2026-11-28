# Mockup

Status: approved by the team (PR #36, merged 2026-11-26). The UI is built from it issue by issue, starting with #26.

Figma file: [Ruumileidja – mockup ja kasutajateekond](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6). Desktop frames, 1440 px wide, Estonian UI. Visual style: [IBM Carbon](https://carbondesignsystem.com), Gray 10 theme, font IBM Plex Sans, after the team review (#17, Tormi's comment #4). Colours are Figma variables that map to Tailwind tokens.

The user journey that connects the screens is in [`docs/automata/search-journey.md`](../automata/search-journey.md), and its user stories are in [`docs/user-stories.md`](../user-stories.md). "Data model" below means `docs/data-model.md` (merged with PR #35).

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
| [08](https://www.figma.com/design/2SPCOq7PtZUeAJRho51uw6?node-id=5-1080) | States: event types by popularity with "add new type", toasts, missing required inputs, no result, open advanced settings (weights) | 0, 1.1, 3 |
| 04b (last frame) | A CSV file dragged anywhere on the page: drop zone over the whole page, opens the CSV tab | 1.4 |

All room codes, course codes and counts in the frames are illustrative, not ASIO data.

## Design choices

All of these are unconfirmed decisions by the frontend role (listed in #17).

- **One page for all inputs.** The idea description (idea 2, agreed acceptance condition) has the organiser choose options from a dropdown during a meeting, so every input is visible at once. The editors for room and curriculum groups are separate views because they are used before the meeting.
- **Saved groups first.** Each section starts with a dropdown of saved groups; "Muuda gruppi" and "+ Uus grupp" open the editor.
- **Times in Europe/Tallinn, sent in UTC.** Every time on screen is local time; the UI converts at the boundary and says so next to the inputs (team rule "Kasutame ainult UTC aega!!!", #17). Only the result adds the UTC time in small print, as frame 07 does.
- **Request errors and warnings are toasts** (react-toastify, team rule point 0); field validation is shown inline next to the field. The next-semester warning is also kept as a banner in the time section, so it stays visible after the toast closes.
- **Complexity weights belong to the search**, not to a room group, as in the data model (`searches.complexity_weights`). They are hidden in a collapsed "Täpsemad seaded" section (Tormi's comment #1).
- **Candidate times are ranked.** The section is called "Kandidaatajad"; days, and ranges within a day, carry a rank and can be moved. The order is the preference (Tormi's comment #2, decision in #17).
- **A CSV file can be dropped anywhere.** The page shows a drop zone and switches to the CSV tab (Tormi's comment #3).

## Questions for the other roles

Raised here; to be added to the issues named in the Owner column with the frontend member's permission. Until answered, the UI uses the working assumption.

| # | Question | Working assumption | Owner |
|---|---|---|---|
| UI-1 | ASIO groups are per study year (`IFIFB-1`, `IFIFB-2`). The data model's curriculum item has no year. Where is the year stored? | Decided in #32: one item is one ASIO group (a curriculum in one study year); `asio_id` holds its code, e.g. `IFIFB-1`, and the UI requires it | Database, backend (#28, #30) |
| UI-2 | Can the UI know the next-semester start date S before the search runs, to warn while the user picks days? | The backend returns the UTC instant of local midnight on S; until then a constant, `PLACEHOLDER(#20)` | Backend (#20) |
| UI-3 | Does the search run asynchronously, and how does the UI follow it (polling `searches.status`, Realtime, or one long request)? | Polling every 2 s, giving up after 2 minutes | Backend (#23) |
| UI-4 | The data model has an optional `course` per unsuitable group (5.5). Will the matching fill it? Frame 07 shows the course name. | `course` per unsuitable group, as in 5.5 | Backend (#22, #23) |
| UI-5 | CSV times in UTC (data model Q2) are hard to write by hand. Could the CSV use local time? | UTC as in the data model; the help text shows the conversion | Backend (#31) |
| UI-6 | Which ASIO link opens a room's calendar from the result? | Link hidden until the URL pattern is known | Backend (#21) |
| UI-7 | Mockup room codes look like real buildings (A-543). The seed uses `DEMO-` codes. | Switch the frames to `DEMO-` codes in the next Figma pass | Frontend |
| UI-8 | Is there a call that checks a CSV and returns row errors and the parsed time windows before the search is created? `searches.time_windows` is required on insert. | Yes, a separate check call | Backend (#31) |
| UI-9 | #23 says 1.2 is always required, #33 says the CSV may replace 1.2. Is a search with only a CSV valid? | Yes, an accepted CSV counts as 1.2 (data model section 2) | Backend (#23, #31) |
| UI-10 | Is a time range shorter than the event duration invalid in the UI, or left to the matching? | Invalid in the UI | Backend (#20, #22) |
| UI-11 | Does the matching leave out rooms whose capacity is below the attendee count (data model Q8)? Frame 01 says so under "Osalejaid". | Yes, `rooms.capacity` ≥ `searches.attendees` when the count is given | Backend (#22) |

## Not in the mockup

- Mobile layout: the main use is a laptop during a meeting. Working assumption: below 1024 px the columns stack.
- A list of earlier searches: not in the task; the data model keeps searches, so it can be added later.
- Prototype links between frames and a Figma journey page: the journey is documented in Markdown instead.

## Built differently from the mockup

- Event type (frame 08 A): a text field with the browser's suggestions in popularity order instead of a custom dropdown with counts, an "ainult sina" badge and a "Lisa uus tüüp" row. Decision in #25: "Brauseri soovitusväli (Recommended)". The data model function returns no owner, so "ainult sina" could not be shown anyway.
- Room codes: the app shows the `DEMO-` rooms of the seed data until the real catalogue (#40) exists (UI-7).
- Summary card (frame 01): the time check reads "Lisa kuupäev ja paranda vigased ajavahemikud (1.2)" when it is missing, because every range must be valid before the search can be sent (#27).
- Loading screen (frame 06): the three steps follow what the UI can know: sending the search, `pending` and `running`. `searches.status` cannot tell collecting from computing. Without the sentence "Võid lehe lahti jätta – tulemus salvestatakse ja jääb alles": the UI cannot return to a search yet (journey Unknowns) (#27).
- Result (frame 07): no "Ava ruumi kalender ASIOs" until the link is known (UI-6). Without curricula the card says that no class times were checked (#27).
- Curricula card (frame 01): "Õppekavu ei arvestata" is the first choice of the dropdown instead of the checkbox "Ära arvesta õppekavadega". As in the frame, the order is changed in the editor only (#32).
- Curriculum group editor (frame 05): no "Lähtegrupp" dropdown, because "Muuda gruppi" opens the group chosen on the main page; one "Grupi nimi" field serves both "Salvesta uue nimega" and "Kirjuta lähtegrupp üle". The tabs are the degree levels in the catalogue, and the place filters list the values of the open tab. Until #30 reads ASIO, the curricula and courses are made-up `Demo` examples (#32).
- No result (frame 08 D): no "Sobivat aega ei leitud" info toast; the page already says it (#27).
- CSV upload (frames 04 and 04b): the form keeps its open cards instead of the collapsed "Muuda" rows of frame 04. The drop zone says that a file can be dropped anywhere on the page. "Kasuta koos käsitsi sisestatud aegadega" is turned on when the file is accepted if the manual times have no problems, otherwise off. The sample file and the format help follow data model Q2 and are marked "kinnitamata · #31" (#33).
