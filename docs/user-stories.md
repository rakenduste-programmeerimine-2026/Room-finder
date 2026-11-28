# User stories

Built from the automata in `docs/automata/`. Times in guards and acceptance criteria are UTC; where a criterion is about what the user enters or sees, the Europe/Tallinn value is given next to its UTC value. "Data model" means `docs/data-model.md` (merged with PR #35).

## Search journey

Automaton: [`docs/automata/search-journey.md`](automata/search-journey.md). Role: an event organiser at Tallinn University.

### US-001: Start without an account

Automaton: search journey, [*] → Composing
Source: [REQUIREMENT #17] "Kontot pole vaja luua nagu eelmises andmebaas töötab samal põhimõttel."

As an organiser, I want to use the app without creating an account, so that I can start right away.

Acceptance criteria:
- Given a first visit, when the app opens, then the search form is shown and no sign-up is asked for.
- Given groups saved earlier in the same browser, when the app opens, then they are in the group dropdowns.

### US-002: Choose a saved room group

Automaton: search journey, Composing → Composing
Source: [REQUIREMENT #25] "Kasutaja saab moodustada ruumi gruppe ise ja luua eelisjärjestuse ruumide osas, neile nime anda ja neid salvestada."

As an organiser, I want to pick a saved room group from a dropdown, so that I do not search ASIO by hand.

Acceptance criteria:
- Given saved room groups, when I pick one, then its rooms appear in rank order with capacity, teaching flag and complexity class.

### US-003: Build, rank and save a room group

Automaton: search journey, Composing → RoomGroupEditor → Composing, and RoomGroupEditor → RoomGroupEditor
Source: [REQUIREMENT #25] "Kasutaja saab moodustada ruumi gruppe ise ja luua eelisjärjestuse ruumide osas, neile nime anda ja neid salvestada." and "nime varjandid otsitavuseks many to one"

As an organiser, I want to find rooms by code or any name variant, order them and save the group, so that my preferred rooms are tried first next time too.

Acceptance criteria:
- Given the editor, when I type "aula", then every room with a matching code or name variant is listed once.
- Given rooms in the group, when I drag a row or use the arrows, then the ranks update.
- Given a name of 1 or 100 characters, not used by my other room groups, and 1 or 200 rooms, when I save, then I return to the form with the group selected and a success toast.
- Given a name with spaces around it, when I save, then it is saved without them.
- Given a name of 0 or 101 characters, only spaces, or one I already use, when I save, then I stay in the editor with an error toast and my changes.
- Given 0 rooms, when I save, then I stay in the editor with an error toast; given 200 rooms, then "+ Lisa" is disabled.
- Given the save request fails, when I save, then I stay in the editor with an error toast and my changes.
- Given unsaved changes, when I cancel, then I return to the form and the saved group is unchanged.

### US-004: Choose or add an event type

Automaton: search journey, Composing → Composing
Source: [REQUIREMENT #25] "võimalus eksisteeriva üritustüübiga siduda näiteks koosolek või uus tüüp lisada järgmiseks korraks (järjestatud populaarsuse järgi kasutajaliideses)"

As an organiser, I want event types ordered by popularity and the option to add a new one, so that the common choice is on top.

Acceptance criteria:
- Given event types with use counts, when I open the suggestions, then they are ordered by count, highest first.
- Given text that matches no type, when I type it, then it is used for this search, and offered to me next time after a search with it has been created. The field is a text field with the browser's suggestions, not the dropdown of frame 08: [REQUIREMENT #25] "Brauseri soovitusväli (Recommended)".
- Given a new type of 1 or 60 characters after trimming, then it is accepted; given 0 or 61, then it is rejected.

### US-005: Weigh room complexity classes

Automaton: search journey, Composing → Composing
Source: [REQUIREMENT #25] "kasutaja poolt reguleeritav kaaluviht 0-1ni ümardatud float" and [REQUIREMENT #17] "see võiks mingi silma taga/ dropdowni taga peidetav olla"

As an organiser, I want to set a weight from 0 to 1 for each complexity class, so that rooms that are hard to get count less.

Acceptance criteria:
- Given a new search, when the form opens, then the weights are hidden in the collapsed "Täpsemad seaded" section and use the defaults.
- Given a weight field, when I enter 0,456, then it becomes 0,46.
- Given a weight field, when I enter 1,2 or −0,1, then it becomes 1,00 or 0,00.

### US-006: Enter days and time ranges

Automaton: search journey, Composing → Composing
Source: [REQUIREMENT #26] "kasutaja saab lisada päeva, päevale mitu võimaliku vahemiku, saab lisada mitu võimaliku päeva." and [REQUIREMENT #17] "Võiks kirjas olla, et on kandidaat ajad ja neid võiks ka saada järjestada"

As an organiser, I want to add several days with several ranges each, so that I can list every time that could work.

Acceptance criteria:
- Given days 1 and 2 December, when I move 2 December up, then it is ranked first and sent first in `time_windows`.
- Given ranges 10:00–12:00 and 13:00–16:00 on one day, when I move the second up, then it is sent first within that day.
- Given 1 December 2026 10:00–12:00 local, when the search is sent, then the range is 2026-12-01T08:00:00Z–2026-12-01T10:00:00Z.
- Given 1 December 2026 23:00–24:00 local, when the search is sent, then the range is 2026-12-01T21:00:00Z–2026-12-01T22:00:00Z.
- Given the local day 29 March 2026 (23 hours), when it is sent, then it is 2026-03-28T22:00:00Z–2026-03-29T21:00:00Z.
- Given the local day 25 October 2026 (25 hours), when it is sent, then it is 2026-10-24T21:00:00Z–2026-10-25T22:00:00Z.
- Given a range whose start equals or is after its end, when I add it, then it is marked invalid and the search cannot start.
- Given 23:00–00:00 entered, when the search is sent, then the end is the next local midnight (23:00–24:00); given 00:00–00:00, then the range is marked invalid.
- Given a 1 h 30 min event, a range of exactly 1 h 30 min is valid and one of 1 h 29 min is marked invalid (UI-10, working assumption).

### US-007: Warn about next semester

Automaton: search journey, Composing → Composing
Source: [REQUIREMENT #26] "Juhul kui küsitakse andmeid järgmisel poolaastal toimuvate tundide kohta lisa hoiatus, et õppekavade koostajatel on eelisjärjekord ruumide osas ja broneeringut tehes õppetöös kasutatavatele ruumidele on oht ruum kaotada." and "The next-semester warning is shown with toastify."

As an organiser, I want a warning when my days are in the next semester, so that I know a teaching room may be taken away.

Acceptance criteria:
- Given the next semester starts on local date S, when I add the local date S − 1, then no warning is shown.
- Given the same, when I add S (its UTC start is S 00:00 Europe/Tallinn), then a warning toast appears and a banner stays in the time section.

### US-008: Upload a CSV file

Automaton: search journey, CSV upload (every transition)
Source: [REQUIREMENT #33] "Alternatiivselt saab 1.2) asemel kindla struktuuriga csv faili üles laadida, mida backend selle asemel või koos sellega töötlema hakkab." and "Upload with format help; errors shown as toastify warnings." and [REQUIREMENT #17] "vaata et kui keegi mingi csv tirib siis isegi teises vaates olles läheks automaatselt laadi csv -fail-ile üle"

As an organiser, I want to upload times as a CSV file instead of or together with manual input, so that I can reuse a list I already have.

Acceptance criteria:
- Given no file, when I open the CSV tab, then the format, an example and a sample file to download are shown.
- Given the manual tab is open, when I drag a CSV file over the page, then a drop zone covers the page; when I drop it, then the CSV tab opens and the file is checked.
- Given a file that is not .csv, or 1 MB + 1 byte, when I drop it, then it is not sent and an error toast says why; a 1 MB .csv file is sent (1 MB = 1 048 576 bytes).
- Given a valid file, when the server accepts it, then the file name and the number of rows and days are shown.
- Given a file with bad rows, when the server rejects it, then an error toast names the rows and the file is marked invalid.
- Given the check request fails, when it ends, then the file is removed and an error toast is shown.
- Given an accepted or rejected file, when I choose another file, then it replaces the old one and is checked; when I remove it, then no file is used.
- Given an accepted file and manual times, when "Kasuta koos käsitsi sisestatud aegadega" is on, then both are sent; when it is off, then only the CSV ranges are sent. It is on at first when the manual times have no problems.
- Given a file being checked, when I choose another file, then only the answer about the new file counts.
- Given the loading screen, a result or an editor, when I drop a file, then nothing happens.

### US-009: Choose, rank and save curricula and courses

Automaton: search journey, Composing → CurriculumGroupEditor → Composing, and CurriculumGroupEditor → CurriculumGroupEditor
Source: [REQUIREMENT #32] "Kasutaja saab valida kas varem kokkupandud gruppide seast, valida grupi ja tagantjärele muuta seda ning uue nimega salvestada ja eelisjärjekorra õppekavade vahel koostada."

As an organiser, I want to pick curricula and optionally courses whose classes the event must avoid, and rank them, so that the most important students can attend.

Acceptance criteria:
- Given the editor, then the curricula are listed by degree level as on the ASIO page, each with its study years to check (decision in #32: one item is one ASIO group).
- Given two curricula, when I move the second one up, then the saved and sent order has it first.
- Given a saved curriculum group, when I change it and save under a new name, then both groups exist.
- Given a saved curriculum group, when I change it and overwrite it, then only the changed group exists.
- Given 1 or 200 curricula and a valid name, when I save, then it is saved; given 0 curricula, or a name that is invalid or taken, then I stay in the editor with an error toast and my changes.
- Given the save request fails, when I save, then I stay in the editor with an error toast and my changes.
- Given unsaved changes, when I cancel, then the saved group is unchanged.
- Given a curriculum with no courses chosen, when the search is sent, then the whole curriculum counts.
- Given no curricula, when I search, then the search runs (1.3 is optional).

### US-010: Start the search

Automaton: search journey, Composing → Submitting → Waiting, and Composing → Composing
Source: [REQUIREMENT #23] "Punktid 1.1 ja 1.2 on alati nõutud, 1.3 ja 1.4 on valikulised ning iga kombinatsioon neist on lubatud kaasaarvatud tühihulk."

As an organiser, I want the search button to work only when the required parts are filled, so that I do not wait for a search that cannot succeed.

Acceptance criteria:
- Given no rooms, when I look at the summary, then the button is disabled and "Vali vähemalt üks ruum (1.1)" is listed; when I press that line, then the focus moves to the "Ruumid" section.
- Given a name over 100 characters or an attendee count outside 1–10000, then the button is disabled and "Paranda ürituse andmeid" is listed.
- Given a CSV still being checked, then the button is disabled.
- Given rooms, at least one valid range, an event type and a duration, with or without curricula and CSV, when I press the button, then the loading screen appears.
- Given I press the button twice quickly, then one search is sent.
- Given the request fails, then I stay on the form with my inputs and an error toast.

### US-011: Wait for the result

Automaton: search journey, Waiting → Waiting and Waiting → Composing
Source: [REQUIREMENT #27] "Igaksjuhuks võiks frontend mingi ooteekraani teha kuni backendilt vastust ootab." and "errors as toastify warnings"

As an organiser, I want to see that the search is running, so that I know the app has not frozen.

Acceptance criteria:
- Given a pending or running search, when I wait, then the loading screen shows progress and "Katkesta ootamine": "Salvestan otsingu" while the search is sent, "Ootan järjekorras" while it is `pending`, "Kogun ASIOst andmeid … ja arvutan parima aja ja ruumi" while it is `running`.
- Given a status check that gets no answer, then the next check follows 2 s later.
- Given a failed search, when the status arrives, then I return to the form with my inputs and an error toast.
- Given no answer after 2 minutes, then I return to the form with my inputs and an error toast (UI-3, working assumption).
- Given I press "Katkesta ootamine", then I return to the form with my inputs.

### US-012: See the best time and room

Automaton: search journey, Waiting → Result → Composing
Source: [REQUIREMENT #27] "Frontend kuvab backendist saadetud vastuse ja nimekirja gruppidest kellele see aeg ei sobinud."

As an organiser, I want the best time and room and the groups it does not suit, so that I can propose it at once.

Acceptance criteria:
- Given a result of 2026-12-01T12:00:00Z–2026-12-01T13:30:00Z, when it is shown, then it reads "Teisipäev, 1. detsember 2026, 14:00 – 15:30" with "UTC 12:00 – 13:30" in small print, the room and its booking method.
- Given a result whose `warnings` holds `next_semester`, then a warning toast is shown and the warning stays in the "Hoiatused" box.
- Given unsuitable groups, when the result is shown, then they are listed in the order of the search's curricula (matched against `searches.curricula`), each with its overlapping class times in local time.
- Given a result, when I press "Muuda sisendeid", then the form opens with the same inputs; when I press "Uus otsing", then it opens empty.

### US-013: No suitable time

Automaton: search journey, Waiting → NoResult → Composing
Source: [UNDERSTANDING] `result.best` is null (data model 5.5)

As an organiser, I want to know when nothing fits and what to change, so that I can try again quickly.

Acceptance criteria:
- Given a result with no best time, when it is shown, then suggestions, "Muuda sisendeid" and "Uus otsing" are shown.
- Given that view, when I press "Muuda sisendeid", then my inputs are kept; when I press "Uus otsing", then the form is empty.

### US-014: Event name, length and attendees

Automaton: search journey, Composing → Composing
Source: [UNDERSTANDING] `name`, `duration_minutes` and `attendees` (data model 4.3, Q8); the 12-hour limit is [REQUIREMENT #37] "Kestus UI-s kuni 12 h (Recommended)"

As an organiser, I want to give the event a name, its length and the number of people, so that only long enough times and big enough rooms are offered.

Acceptance criteria:
- Given a duration of 5 or 720 minutes, then it is accepted; given 4 or 721, then it is rejected. The database still allows up to 1440.
- Given a changed duration, then every candidate range shorter than it is marked.
- Given no attendee count, then the search can still run; given 1 or 10000, then it is accepted; given 0 or 10001, then it is rejected.
- Given no name, then the search can still run; given a name of 100 characters, then it is accepted; given 101, then it is rejected.
