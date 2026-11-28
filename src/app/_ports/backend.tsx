"use client";

import { createContext, use } from "react";
import type { Backend } from "./ports";
import { createStubBackend } from "./stubs";

/**
 * How client components reach the backend. The default value is the
 * composition root: today the stubs, PLACEHOLDER(#19, #20, #23, #30, #40); the backend's adapters
 * replace them one port at a time. Tests pass their own value.
 */
export const BackendContext = createContext<Backend>(createStubBackend());

export function useBackend(): Backend {
  return use(BackendContext);
}
