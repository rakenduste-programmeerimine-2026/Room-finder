import type { Check, SummaryRow } from "@/app/_lib/search-summary";
import { Check as CheckIcon, Close } from "./icons";
import { helper, primaryButton } from "./styles";

/** The inputs of a search as labels and values. */
export function InputSummary({ rows }: { rows: SummaryRow[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-ink-muted">{row.label}</dt>
          <dd className="text-sm">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type SearchSummaryProps = { rows: SummaryRow[]; checks: Check[]; onSubmit: () => void };

/**
 * Frame 01 "Kokkuvõte": the inputs, the required parts and "Leia aeg ja ruum"
 * (US-010). A missing part is a button that takes the focus to its section (frame 08 C).
 */
export function SearchSummary({ rows, checks, onSubmit }: SearchSummaryProps) {
  const ready = checks.every((check) => check.ok);
  return (
    <aside aria-labelledby="kokkuvote" className="flex flex-col gap-4 bg-layer p-5 lg:sticky lg:top-6">
      <h2 id="kokkuvote" className="text-xl font-normal">Kokkuvõte</h2>
      <InputSummary rows={rows} />
      <ul aria-label="Kohustuslikud osad" className="flex flex-col gap-1.5 text-sm">
        {checks.map((check) => (
          <li key={check.target}>
            {check.ok ? (
              <span className="flex items-center gap-2">
                <span className="text-success"><CheckIcon /></span>
                {check.text}
              </span>
            ) : (
              <button type="button" className="flex items-center gap-2 text-left text-error-ink hover:underline"
                onClick={() => document.getElementById(check.target)?.focus()}>
                <Close />
                {check.text}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className={`${primaryButton} w-full`} disabled={!ready} onClick={onSubmit}>
        Leia aeg ja ruum
      </button>
      <p className={helper}>
        {ready
          ? "Ootamise ajal näed ooteekraani."
          : "Nupp hakkab tööle, kui kohustuslikud osad on täidetud. Vajuta puuduvale osale, et see üles leida."}
      </p>
    </aside>
  );
}
