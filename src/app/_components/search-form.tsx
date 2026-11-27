"use client";

import { useState } from "react";
import { EMPTY_EVENT } from "@/app/_lib/event";
import { EventFields } from "./event-fields";
import { TimeWindowTool } from "./time-window-tool";

const card = "flex max-w-4xl flex-col gap-4 bg-layer p-6";

/** The new search. It holds the inputs that depend on each other: the event duration limits the time ranges. */
export function SearchForm() {
  const [event, setEvent] = useState(EMPTY_EVENT);

  return (
    <>
      <section aria-labelledby="uritus" className={card}>
        <h2 id="uritus" className="text-xl font-normal">Üritus</h2>
        <EventFields value={event} onChange={setEvent} eventTypes={[]} />
      </section>

      <section aria-labelledby="kandidaatajad" className={card}>
        <div className="flex flex-col gap-1">
          <h2 id="kandidaatajad" className="text-xl font-normal">Kandidaatajad</h2>
          <p className="text-sm text-ink-muted">
            Järjesta eelistuse järgi: üleval olev päev ja iga päeva esimene vahemik on kõige eelistatumad.
          </p>
        </div>
        <TimeWindowTool durationMinutes={event.durationMinutes} />
      </section>
    </>
  );
}
