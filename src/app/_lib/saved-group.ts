import { charLength } from "./text";

export const MAX_GROUP_NAME_LENGTH = 100;
/** Rooms or curricula in one group (`saved_groups.items`, data model 4.2). */
export const MAX_GROUP_ITEMS = 200;

export type GroupIssue = "missing_name" | "name_too_long" | "name_taken" | "empty" | "too_many";

/**
 * Checks a room or curriculum group before it is saved (`saved_groups`, data model 4.2): a trimmed
 * name of 1–100 characters that none of the user's other groups of that kind has, and 1–200 items.
 */
export function checkGroup(
  name: string,
  size: number,
  otherNames: readonly string[],
): { name: string; issues: GroupIssue[] } {
  const trimmed = name.trim();
  const issues: GroupIssue[] = [];
  if (!trimmed) issues.push("missing_name");
  else if (charLength(trimmed) > MAX_GROUP_NAME_LENGTH) issues.push("name_too_long");
  else if (otherNames.includes(trimmed)) issues.push("name_taken");
  if (size === 0) issues.push("empty");
  else if (size > MAX_GROUP_ITEMS) issues.push("too_many");
  return { name: trimmed, issues };
}
