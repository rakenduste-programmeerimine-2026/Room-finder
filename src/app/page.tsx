import { TimeWindowTool } from "./_components/time-window-tool";
import { formatDuration } from "./_lib/format";

// PLACEHOLDER(#37): the event duration comes from the event part of the form.
const EVENT_DURATION_MINUTES = 60;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-8 md:px-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal">Uus otsing</h1>
        <p className="text-sm text-ink-muted">Kõik ajad on Tallinna aja järgi.</p>
      </div>

      <section aria-labelledby="kandidaatajad" className="flex max-w-4xl flex-col gap-4 bg-layer p-6">
        <div className="flex flex-col gap-1">
          <h2 id="kandidaatajad" className="text-xl font-normal">Kandidaatajad</h2>
          <p className="text-sm text-ink-muted">
            Järjesta eelistuse järgi: üleval olev päev ja iga päeva esimene vahemik on kõige eelistatumad.
          </p>
          {/* PLACEHOLDER(#37): replaced by the duration field. */}
          <p className="text-xs text-helper">
            Ürituse kestus: {formatDuration(EVENT_DURATION_MINUTES)} (ajutine väärtus, kuni kestuse valik on olemas).
          </p>
        </div>
        <TimeWindowTool durationMinutes={EVENT_DURATION_MINUTES} />
      </section>
    </main>
  );
}
