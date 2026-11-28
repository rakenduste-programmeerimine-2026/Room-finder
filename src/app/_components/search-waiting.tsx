import { useEffect, useRef } from "react";
import { count } from "@/app/_lib/format";
import { Check } from "./icons";
import { ghostButton } from "./styles";

/** Sending the search, then the two statuses of `searches.status` before the answer. */
export type WaitingStep = "submitting" | "pending" | "running";
const STEPS: WaitingStep[] = ["submitting", "pending", "running"];

export type SearchWaitingProps = { step: WaitingStep; roomCount: number; curriculumCount: number; onCancel: () => void };

/** Frame 06: the loading screen while the search is sent and the backend works (US-011). */
export function SearchWaiting({ step, roomCount, curriculumCount, onCancel }: SearchWaitingProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const labels: Record<WaitingStep, string> = {
    submitting: "Salvestan otsingu",
    pending: "Ootan järjekorras",
    running: `Kogun ASIOst andmeid (${[
      count(roomCount, "ruum", "ruumi"),
      curriculumCount ? count(curriculumCount, "õppekava", "õppekava") : "",
    ].filter(Boolean).join(", ")}) ja arvutan parima aja ja ruumi`,
  };
  const current = STEPS.indexOf(step);

  return (
    <section aria-labelledby="ootamine"
      className="mx-auto mt-16 flex w-full max-w-xl flex-col items-center gap-5 bg-layer px-10 py-10 text-center shadow-md">
      <span aria-hidden="true" className="size-10 rounded-full border-4 border-subtle border-t-interactive motion-safe:animate-spin" />
      <h1 id="ootamine" ref={heading} tabIndex={-1} className="text-2xl font-normal focus:outline-none">
        Otsin parimat aega ja ruumi…
      </h1>
      <p className="text-sm text-ink-muted">
        Kogun ASIOst ruumide broneeringud ja tunniplaanid ning arvutan sobivaima variandi. Ootan vastust kuni 2
        minutit, sinu sisendid jäävad alles.
      </p>
      <ol aria-label="Otsingu sammud" className="flex w-full flex-col gap-2 bg-page px-4 py-3 text-left text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 ${i > current ? "text-ink-muted" : ""} ${i === current ? "font-semibold" : ""}`}>
            <span aria-hidden="true" className="grid size-4 place-items-center">
              {i < current ? (
                <span className="text-success"><Check /></span>
              ) : i === current ? (
                <span className="size-2 rounded-full bg-interactive" />
              ) : (
                <span className="size-3 rounded-full border border-strong" />
              )}
            </span>
            {labels[s]}
            <span className="sr-only">{i < current ? " – tehtud" : i === current ? " – käib" : ""}</span>
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">{labels[step]}</p>
      <button type="button" className={ghostButton} onClick={onCancel}>Katkesta ootamine</button>
    </section>
  );
}
