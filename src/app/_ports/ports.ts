import type { UtcInstant } from "@/app/_lib/time/tallinn";

/**
 * What the UI needs from the backend. One small interface per capability; the
 * backend role writes the real adapters, which must pass the suites in
 * ./contracts. Ports are added as their UI issues start. Arguments and results
 * are plain, serialisable data, so a Server Action can implement a method.
 */

/** The next semester, for the warning in point 1.2 (#26, #20). */
export interface Semester {
  /** When the next semester begins: the UTC instant of local midnight on its first day. */
  nextStart(): Promise<UtcInstant>;
}

export type Backend = {
  semester: Semester;
};
