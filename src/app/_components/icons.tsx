import type { SVGProps } from "react";

/** Small line icons (16 px, current colour), hidden from screen readers. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChevronUp = () => <Icon><path d="m18 15-6-6-6 6" /></Icon>;
export const ChevronDown = () => <Icon><path d="m6 9 6 6 6-6" /></Icon>;
export const Close = () => <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const Clock = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const Warning = () => (
  <Icon width="20" height="20">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);
