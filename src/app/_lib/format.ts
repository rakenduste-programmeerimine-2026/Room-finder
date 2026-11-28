/** A count with the Estonian singular after 1: count(1, "ruum", "ruumi") → "1 ruum", count(2, …) → "2 ruumi". */
export const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A number with 2 decimals and a decimal comma: 0.7 → "0,70". */
export const decimal = (n: number): string => n.toFixed(2).replace(".", ",");

/** A duration for display: 90 → "1 h 30 min", 60 → "1 h", 45 → "45 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours} h` : "", rest ? `${rest} min` : ""].filter(Boolean).join(" ") || "0 min";
}
