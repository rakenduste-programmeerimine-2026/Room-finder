import type { Backend } from "./ports";

/** Stand-ins for the backend until its adapters exist. */
export function createStubBackend(): Backend {
  return {
    semester: {
      // PLACEHOLDER(#20): an illustrative start of spring 2027 (1 February,
      // 00:00 in Tallinn), not taken from ASIO or the academic calendar. A
      // fixed date goes stale once it passes.
      nextStart: async () => "2027-01-31T22:00:00Z",
    },
  };
}
