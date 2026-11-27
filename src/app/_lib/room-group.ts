import { charLength } from "./text";

export const MAX_GROUP_NAME_LENGTH = 100;
export const MAX_GROUP_ROOMS = 200;

export type GroupIssue = "missing_name" | "name_too_long" | "name_taken" | "no_rooms" | "too_many_rooms";

/**
 * Checks a room group before it is saved (`saved_groups`, data model 4.2): a trimmed name of
 * 1–100 characters that none of the user's other room groups has, and 1–200 rooms.
 */
export function checkRoomGroup(
  name: string,
  roomCodes: readonly string[],
  otherNames: readonly string[],
): { name: string; issues: GroupIssue[] } {
  const trimmed = name.trim();
  const issues: GroupIssue[] = [];
  if (!trimmed) issues.push("missing_name");
  else if (charLength(trimmed) > MAX_GROUP_NAME_LENGTH) issues.push("name_too_long");
  else if (otherNames.includes(trimmed)) issues.push("name_taken");
  if (roomCodes.length === 0) issues.push("no_rooms");
  else if (roomCodes.length > MAX_GROUP_ROOMS) issues.push("too_many_rooms");
  return { name: trimmed, issues };
}
