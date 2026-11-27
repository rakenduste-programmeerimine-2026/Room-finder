import type { ComponentProps } from "react";
import { ChevronDown } from "./icons";
import { field } from "./styles";

/** A Carbon-style native select with a chevron. */
export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <span className="relative flex">
      <select {...props} className={`${field} w-full appearance-none pr-10 ${className}`} />
      <span className="pointer-events-none absolute top-3 right-3 text-ink-muted"><ChevronDown /></span>
    </span>
  );
}
