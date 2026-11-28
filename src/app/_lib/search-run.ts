import type { Best, SearchResult, SearchStatus } from "@/app/_ports/ports";

/** How often the loading screen asks for the status, and when it gives up (UI-3, working assumption). */
export const POLL_MS = 2_000;
export const GIVE_UP_MS = 120_000;

/**
 * The search journey from "Leia aeg ja ruum" on (docs/automata/search-journey.md).
 * The room group editor is a view inside Composing.
 */
export type SearchRun =
  | { state: "composing" }
  | { state: "submitting" }
  | { state: "waiting"; id: string; status: "pending" | "running" }
  | { state: "result"; id: string; best: Best; result: SearchResult }
  | { state: "no_result"; id: string; result: SearchResult };

export type SearchEvent =
  | { type: "submit" }
  | { type: "created"; id: string }
  | { type: "start_failed" }
  | { type: "status"; id: string; status: SearchStatus }
  | { type: "timeout"; id: string }
  /** "Katkesta ootamine", "Muuda sisendeid" or "Uus otsing". */
  | { type: "back" };

export const COMPOSING: SearchRun = { state: "composing" };

/**
 * The next state of the journey. An event that does not apply, such as a
 * second press of the button or the answer of a search the user stopped
 * waiting for, returns the same object.
 */
export function nextRun(run: SearchRun, event: SearchEvent): SearchRun {
  switch (event.type) {
    case "submit":
      return run.state === "composing" ? { state: "submitting" } : run;
    case "created":
      return run.state === "submitting" ? { state: "waiting", id: event.id, status: "pending" } : run;
    case "start_failed":
      return run.state === "submitting" ? COMPOSING : run;
    case "status": {
      if (run.state !== "waiting" || run.id !== event.id) return run;
      const answer = event.status;
      if (answer.status === "failed") return COMPOSING;
      if (answer.status === "done") {
        const { best } = answer.result;
        return best
          ? { state: "result", id: run.id, best, result: answer.result }
          : { state: "no_result", id: run.id, result: answer.result };
      }
      return answer.status === run.status ? run : { ...run, status: answer.status };
    }
    case "timeout":
      return run.state === "waiting" && run.id === event.id ? COMPOSING : run;
    case "back":
      return run.state === "composing" ? run : COMPOSING;
  }
}
