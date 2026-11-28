"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { COMPOSING, GIVE_UP_MS, nextRun, POLL_MS, type SearchEvent, type SearchRun } from "@/app/_lib/search-run";
import { toUtcInstant } from "@/app/_lib/time/tallinn";
import { useBackend } from "@/app/_ports/backend";
import { SearchForm, type Submission } from "./search-form";
import { NoResultView, SearchResultView, type SentSearch } from "./search-result";
import { SearchWaiting } from "./search-waiting";

const START_FAILED = "Otsingut ei õnnestunud alustada. Sinu sisendid on alles, proovi uuesti.";
const FAILED = "Otsing ebaõnnestus. Sinu sisendid on alles, proovi mõne minuti pärast uuesti.";
const TIMED_OUT = "Vastust ei tulnud 2 minuti jooksul. Sinu sisendid on alles, proovi uuesti.";

/**
 * The search journey (docs/automata/search-journey.md): the form, the loading
 * screen and the result. The form is only hidden while the others are shown, so
 * "Muuda sisendeid" finds every input; "Uus otsing" mounts a new, empty form.
 */
export function SearchJourney() {
  const backend = useBackend();
  const [run, setRun] = useState<SearchRun>(COMPOSING);
  const current = useRef(run);
  const [sent, setSent] = useState<SentSearch | null>(null);
  const [formKey, setFormKey] = useState(0);
  const form = useRef<HTMLDivElement>(null);
  const away = useRef(false);

  /** Moves the journey on. The error toast is shown only if the event took the user back to the form. */
  const send = useCallback((event: SearchEvent, error?: string): boolean => {
    const next = nextRun(current.current, event);
    if (next === current.current) return false;
    current.current = next;
    setRun(next);
    if (error && next.state === "composing") toast.error(error, { autoClose: false });
    return true;
  }, []);

  // Waiting: ask for the status every 2 s and give up after 2 minutes (UI-3).
  const waitingFor = run.state === "waiting" ? run.id : null;
  useEffect(() => {
    if (!waitingFor) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      timer = setTimeout(() => {
        backend.searches
          .status(waitingFor)
          .then(
            (status) => live && send({ type: "status", id: waitingFor, status }, status.status === "failed" ? FAILED : undefined),
            () => {}, // a failed check is tried again until the time limit
          )
          .finally(() => live && check());
      }, POLL_MS);
    };
    check();
    const giveUp = setTimeout(() => send({ type: "timeout", id: waitingFor }, TIMED_OUT), GIVE_UP_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      clearTimeout(giveUp);
    };
  }, [backend, send, waitingFor]);

  // Back on the form: put the focus on its heading.
  useEffect(() => {
    if (run.state === "composing" && away.current) form.current?.querySelector("h1")?.focus();
    away.current = run.state !== "composing";
  }, [run.state, formKey]);

  const submit = (submission: Submission) => {
    if (!send({ type: "submit" })) return;
    setSent({ ...submission, at: toUtcInstant(Date.now()) });
    backend.searches.start(submission.input).then(
      (id) => send({ type: "created", id }),
      () => send({ type: "start_failed" }, START_FAILED),
    );
  };
  const back = () => send({ type: "back" });
  const startOver = () => {
    back();
    setFormKey((key) => key + 1);
  };

  return (
    <>
      <div ref={form} hidden={run.state !== "composing"}>
        <SearchForm key={formKey} onSubmit={submit} active={run.state === "composing"} />
      </div>
      {(run.state === "submitting" || run.state === "waiting") && (
        <SearchWaiting step={run.state === "waiting" ? run.status : "submitting"}
          roomCount={sent?.input.roomCodes.length ?? 0} curriculumCount={sent?.input.curricula?.length ?? 0}
          onCancel={back} />
      )}
      {run.state === "result" && sent && (
        <SearchResultView sent={sent} best={run.best} result={run.result} onEdit={back} onNew={startOver} />
      )}
      {run.state === "no_result" && <NoResultView onEdit={back} onNew={startOver} />}
    </>
  );
}
