import { useId } from "react";
import {
  DURATION_CHOICES,
  MAX_ATTENDEES,
  MAX_NAME_LENGTH,
  MAX_UI_DURATION,
  readEvent,
  type EventDraft,
  type EventIssue,
} from "@/app/_lib/event";
import { formatDuration } from "@/app/_lib/format";
import { MIN_DURATION } from "@/app/_lib/time/time-windows";
import { Select } from "./select";
import { error, field, helper, label } from "./styles";

export type EventFieldsProps = {
  value: EventDraft;
  onChange: (next: EventDraft) => void;
};

const MESSAGES: Record<EventIssue, string> = {
  name_too_long: `Nimi võib olla kuni ${MAX_NAME_LENGTH} märki.`,
  invalid_duration: `Vali kestus ${formatDuration(MIN_DURATION)} kuni ${formatDuration(MAX_UI_DURATION)}.`,
  invalid_attendees: `Sisesta täisarv 1 kuni ${MAX_ATTENDEES.toLocaleString("et")}.`,
};


/** Point 1: the event's name, duration and number of attendees (#37). The event type comes with #25. */
export function EventFields({ value, onChange }: EventFieldsProps) {
  const id = useId();
  const read = readEvent(value);
  const issue = (code: EventIssue) => !read.ok && read.issues.includes(code);
  const set = (change: Partial<EventDraft>) => onChange({ ...value, ...change });

  return (
    <div className="grid gap-x-4 gap-y-2 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className={label}>Ürituse nimi (valikuline)</label>
        <input id={`${id}-name`} type="text" autoComplete="off" value={value.name} className={field}
          aria-invalid={issue("name_too_long")} aria-describedby={`${id}-name-message`}
          onChange={(e) => set({ name: e.target.value })} />
        <p id={`${id}-name-message`} className={error}>{issue("name_too_long") ? MESSAGES.name_too_long : ""}</p>
      </div>

      {/* The event type (#25) takes the free cell next to the name. */}
      <div className="flex flex-col gap-2 lg:col-start-1">
        <label htmlFor={`${id}-duration`} className={label}>Kestus</label>
        <Select id={`${id}-duration`} value={value.durationMinutes} aria-invalid={issue("invalid_duration")}
          aria-describedby={`${id}-duration-message`} onChange={(e) => set({ durationMinutes: Number(e.target.value) })}>
          {DURATION_CHOICES.map((minutes) => (
            <option key={minutes} value={minutes}>{formatDuration(minutes)}</option>
          ))}
        </Select>
        <p id={`${id}-duration-message`} className={issue("invalid_duration") ? error : helper}>
          {issue("invalid_duration") ? MESSAGES.invalid_duration : "Iga kandidaatvahemik peab mahutama terve ürituse."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-attendees`} className={label}>Osalejaid (valikuline)</label>
        <input id={`${id}-attendees`} type="text" inputMode="numeric" autoComplete="off" value={value.attendees}
          className={field} aria-invalid={issue("invalid_attendees")} aria-describedby={`${id}-attendees-message`}
          onChange={(e) => set({ attendees: e.target.value })} />
        <p id={`${id}-attendees-message`} className={issue("invalid_attendees") ? error : helper}>
          {issue("invalid_attendees") ? MESSAGES.invalid_attendees : "Ruumi mahutavus peab olema vähemalt nii suur."}
        </p>
      </div>
    </div>
  );
}
