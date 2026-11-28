import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "react-toastify";
import { csvFileProblem, NO_CSV, type CsvState } from "@/app/_lib/csv";
import { count } from "@/app/_lib/format";
import { useBackend } from "@/app/_ports/backend";
import { Close, Warning } from "./icons";
import { ghostButton, helper, iconButton, secondaryButton } from "./styles";

// PLACEHOLDER(#31): the format is data model Q2 (unconfirmed); the backend decides it.
const SAMPLE = "date,start,end\n2026-12-01,08:00:00Z,10:00:00Z\n2026-12-01,11:00:00Z,14:00:00Z\n2026-12-02,07:00:00Z,09:30:00Z\n";

/**
 * The CSV upload of the search journey: a chosen file is checked on the client (.csv, at most
 * 1 MB) and then by the backend (UI-8); only the answer to the latest file counts.
 */
export function useCsvUpload(manualValid: () => boolean) {
  const backend = useBackend();
  const [csv, setCsv] = useState<CsvState>(NO_CSV);
  const [together, setTogether] = useState(false);
  const latest = useRef(0);

  const choose = useCallback(
    (file: File) => {
      const problem = csvFileProblem(file);
      if (problem) {
        toast.error(
          problem === "not_csv"
            ? `„${file.name}“ ei ole CSV-fail. Vali .csv-laiendiga fail.`
            : `„${file.name}“ on suurem kui 1 MB. Vähenda faili või sisesta ajad käsitsi.`,
          { autoClose: false },
        );
        return;
      }
      const id = ++latest.current;
      setCsv({ state: "checking", name: file.name });
      backend.csvFiles.check(file).then(
        (answer) => {
          if (id !== latest.current) return;
          if (answer.ok) {
            setCsv({ state: "accepted", name: file.name, rows: answer.rows, windows: answer.timeWindows });
            setTogether(manualValid());
            return;
          }
          setCsv({ state: "rejected", name: file.name, errors: answer.errors });
          const shown = answer.errors.slice(0, 3).map((e) => `rida ${e.row}: ${e.message}`).join("; ");
          toast.error(`CSV-failis on ${count(answer.errors.length, "viga", "viga")}: ${shown}${answer.errors.length > 3 ? " …" : ""}.`, {
            autoClose: false,
          });
        },
        () => {
          if (id !== latest.current) return;
          setCsv(NO_CSV);
          toast.error(`Faili „${file.name}“ ei õnnestunud kontrollida. Proovi uuesti.`, { autoClose: false });
        },
      );
    },
    [backend, manualValid],
  );
  const remove = () => {
    latest.current++;
    setCsv(NO_CSV);
  };
  return { csv, together, setTogether, choose, remove };
}

export type CsvUploadProps = {
  csv: CsvState;
  together: boolean;
  /** Days in the manual input, or null while it has problems. */
  manualDays: number | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  onTogether: (on: boolean) => void;
};

/** Frame 04: choose or drop a CSV file, see what the backend made of it, and the format help (US-008). */
export function CsvUpload({ csv, together, manualDays, onFile, onRemove, onTogether }: CsvUploadProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-2 border-2 border-dashed border-strong px-6 py-8 text-center">
          <p className="font-semibold">Lohista CSV-fail siia või vali arvutist</p>
          <p className={helper}>.csv · kuni 1 MB · faili võib lohistada ka mujale lehele</p>
          <input ref={input} id={`${id}-file`} type="file" accept=".csv,text/csv" className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // the same file can be chosen again
              if (file) onFile(file);
            }} />
          <button type="button" className={secondaryButton} onClick={() => input.current?.click()}>Vali fail</button>
        </div>

        <div role="status">
          {csv.state !== "none" && (
            <div className={`flex items-start gap-3 px-4 py-3 ${csv.state === "rejected" ? "bg-error-bg" : "bg-page"}`}>
              {csv.state === "rejected" && <span className="text-error-ink"><Warning /></span>}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-semibold">{csv.name}</span>
                <span className={`text-xs ${csv.state === "rejected" ? "text-error-ink" : "text-ink-muted"}`}>
                  {csv.state === "checking" && "Server kontrollib faili…"}
                  {csv.state === "accepted" &&
                    `${count(csv.rows, "rida", "rida")} · ${count(daysIn(csv.windows), "päev", "päeva")} · server kontrollis faili`}
                  {csv.state === "rejected" && csv.errors.map((e) => `Rida ${e.row}: ${e.message}`).join(" · ")}
                </span>
              </div>
              {csv.state === "accepted" && <span className="rounded-full bg-highlight px-2 py-0.5 text-xs">Korras</span>}
              {csv.state === "rejected" && (
                <span className="text-xs text-error-ink">{count(csv.errors.length, "viga", "viga")}</span>
              )}
              <button type="button" className={iconButton} aria-label={`Eemalda ${csv.name}`} onClick={onRemove}>
                <Close />
              </button>
            </div>
          )}
        </div>

        {csv.state === "accepted" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-interactive" checked={together}
              onChange={(e) => onTogether(e.target.checked)} />
            Kasuta koos käsitsi sisestatud aegadega
            {manualDays === null ? " (käsitsi aegu pole või need on vigased)" : ` (${count(manualDays, "päev", "päeva")})`}
          </label>
        )}
      </div>

      <aside aria-labelledby={`${id}-format`} className="flex flex-col gap-2 bg-page p-4 text-xs">
        <h3 id={`${id}-format`} className="flex items-center gap-2 text-sm font-semibold">
          Faili formaat
          <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-normal">kinnitamata · #31</span>
        </h3>
        <p>Üks rida on üks ajavahemik. Esimene rida on päis. Ajad on UTC-s (ISO 8601), nagu andmemudelis.</p>
        <pre className="overflow-x-auto bg-layer p-2 font-mono">{SAMPLE}</pre>
        <p className="text-ink-muted">08:00Z on talvel Tallinnas 10:00, suvel 11:00. Lae alla näidisfail, et vältida vigu.</p>
        <a className={`${ghostButton} self-start px-0 leading-8`} download="ajad-naidis.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}>
          Lae alla näidis-CSV
        </a>
      </aside>
    </div>
  );
}

const daysIn = (windows: { days: unknown[] }[]) => windows.reduce((sum, period) => sum + period.days.length, 0);

/**
 * Frame 04b: while a file is dragged over the page, a drop zone covers it; dropping the file hands
 * it over (Tormi's decision in #33). While the form is not shown, a dropped file is ignored, and
 * the browser is still kept from opening it, which would leave the page. Drags of anything else,
 * such as ranked rows, are left alone.
 */
export function PageFileDrop({ active, onFile }: { active: boolean; onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    const enter = (e: DragEvent) => {
      if (!active || !hasFiles(e)) return;
      depth.current += 1;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!active || !hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    };
    const allow = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = active ? "copy" : "none";
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // the browser would open the file
      depth.current = 0;
      setOver(false);
      const file = e.dataTransfer?.files[0];
      if (active && file) onFile(file);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", allow);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", allow);
      window.removeEventListener("drop", drop);
      depth.current = 0;
      setOver(false);
    };
  }, [active, onFile]);

  if (!over) return null;
  return (
    <div aria-hidden="true"
      className="pointer-events-none fixed inset-4 z-50 grid place-items-center border-2 border-dashed border-interactive bg-layer/90">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xl">Lase lahti, et laadida CSV-fail</p>
        <p className={helper}>Avame osa „Laadi CSV-fail“ ja server kontrollib faili.</p>
      </div>
    </div>
  );
}

