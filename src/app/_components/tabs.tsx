/** The id of a tab, for its panel's `aria-labelledby`. */
export const tabId = (prefix: string, index: number) => `${prefix}-tab-${index}`;

export type TabsProps = {
  /** The accessible name of the tab list. */
  label: string;
  /** Unique within the page; the tabs' ids start with it. */
  idPrefix: string;
  items: readonly { value: string; text: string }[];
  value: string;
  onChange: (value: string) => void;
  /** The id of the panel a tab shows. */
  panelId: (index: number) => string;
};

/** Carbon-style tabs with the keyboard pattern of WAI-ARIA: the arrow keys move between them. */
export function Tabs({ label, idPrefix, items, value, onChange, panelId }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap border-b border-subtle">
      {items.map((item, i) => (
        <button key={item.value} id={tabId(idPrefix, i)} type="button" role="tab" aria-selected={item.value === value}
          aria-controls={panelId(i)} tabIndex={item.value === value ? 0 : -1}
          className={`-mb-px border-b-2 px-4 py-2 text-sm ${item.value === value ? "border-interactive font-semibold" : "border-transparent text-ink-muted hover:bg-subtle"}`}
          onClick={() => onChange(item.value)}
          onKeyDown={(e) => {
            const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            const next = (i + step + items.length) % items.length;
            onChange(items[next].value);
            document.getElementById(tabId(idPrefix, next))?.focus();
          }}>
          {item.text}
        </button>
      ))}
    </div>
  );
}
