import { useId, useState } from "react";
import {
  changedWeights,
  COMPLEXITY_LABELS,
  COMPLEXITY_ORDER,
  DEFAULT_WEIGHTS,
  formatWeight,
  readWeight,
  type ComplexityWeights,
} from "@/app/_lib/complexity";
import type { Complexity } from "@/app/_ports/ports";
import { ChevronDown } from "./icons";
import { field, ghostButton } from "./styles";

export type ComplexityWeightsProps = {
  value: ComplexityWeights;
  onChange: (next: ComplexityWeights) => void;
};

/** Point 1.1: a weight from 0 to 1 per complexity class, hidden until opened (US-005, Tormi's review in #17). */
export function ComplexityWeightsSection({ value, onChange }: ComplexityWeightsProps) {
  const id = useId();
  // What the user is typing into a number field, until it is read on blur or Enter.
  const [typed, setTyped] = useState<Partial<Record<Complexity, string>>>({});
  const changed = Object.keys(changedWeights(value)).length > 0;

  const set = (complexity: Complexity, weight: number) => onChange({ ...value, [complexity]: weight });
  const commit = (complexity: Complexity) => {
    const text = typed[complexity];
    if (text === undefined) return;
    const weight = readWeight(text);
    if (weight !== null) set(complexity, weight);
    setTyped((all) => {
      const rest = { ...all };
      delete rest[complexity];
      return rest;
    });
  };

  return (
    <details className="group border-y border-subtle">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm">
        <span className="transition-transform group-open:rotate-180"><ChevronDown /></span>
        Täpsemad seaded: keerukusklasside kaalud
        <span className="ml-auto text-xs text-ink-muted">{changed ? "muudetud, kehtivad sellele otsingule" : "vaikimisi"}</span>
      </summary>
      <div className="flex flex-col gap-3 pb-4">
        <p className="text-xs text-ink-muted">
          1,00 = takistust pole, 0,00 = väldi seda klassi. Väärtus ümardatakse 2 komakohani.
        </p>
        <ul className="flex flex-col gap-2">
          {COMPLEXITY_ORDER.map((complexity) => {
            const name = COMPLEXITY_LABELS[complexity];
            return (
              <li key={complexity} className="flex flex-wrap items-center gap-4">
                <label htmlFor={`${id}-${complexity}`} className="w-44 text-sm">{name}</label>
                <input id={`${id}-${complexity}`} type="range" min={0} max={1} step={0.01} value={value[complexity]}
                  aria-valuetext={formatWeight(value[complexity])} className="w-72 accent-interactive"
                  onChange={(e) => set(complexity, Number(e.target.value))} />
                <input type="text" inputMode="decimal" aria-label={`${name}: kaal numbrina`}
                  value={typed[complexity] ?? formatWeight(value[complexity])} className={`${field} w-20`}
                  onChange={(e) => setTyped({ ...typed, [complexity]: e.target.value })}
                  onBlur={() => commit(complexity)}
                  onKeyDown={(e) => e.key === "Enter" && commit(complexity)} />
              </li>
            );
          })}
        </ul>
        <button type="button" className={`${ghostButton} self-start`} disabled={!changed}
          onClick={() => { setTyped({}); onChange(DEFAULT_WEIGHTS); }}>
          Taasta vaikimisi
        </button>
      </div>
    </details>
  );
}
