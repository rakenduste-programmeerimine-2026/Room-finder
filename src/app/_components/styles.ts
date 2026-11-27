/** A Carbon-style input or select: bottom border, blue focus outline, red outline when invalid. */
export const field =
  "h-10 border-0 border-b border-strong bg-layer px-3 text-sm text-ink focus:outline-2 focus:-outline-offset-2 focus:outline-interactive aria-[invalid=true]:outline-2 aria-[invalid=true]:-outline-offset-2 aria-[invalid=true]:outline-error";

/** A square icon-only button, such as the ranking arrows. */
export const iconButton =
  "grid size-8 place-items-center text-ink-muted hover:bg-subtle disabled:text-disabled disabled:hover:bg-transparent";

/** A text button without a background (Carbon "ghost"). */
export const ghostButton = "h-8 px-3 text-sm text-interactive hover:bg-subtle disabled:text-disabled";

/** Carbon "primary" and "secondary" buttons. */
export const primaryButton =
  "h-10 bg-interactive px-4 text-left text-sm text-white hover:bg-interactive-hover disabled:bg-disabled";
export const secondaryButton =
  "h-10 bg-secondary px-4 text-left text-sm text-white hover:bg-secondary-hover disabled:bg-disabled";

export const label = "text-xs text-ink-muted";
export const helper = "text-xs text-helper";
export const error = "text-xs text-error-ink";
