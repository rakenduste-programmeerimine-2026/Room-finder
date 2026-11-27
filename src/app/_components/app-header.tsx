import Link from "next/link";

/** The dark Carbon-style shell header. */
export function AppHeader() {
  return (
    <header className="flex h-12 items-center gap-3 bg-shell px-4 text-shell-ink">
      <Link href="/" className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center bg-interactive font-semibold text-white"
        >
          R
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Ruumileidja</span>
          <span className="text-xs text-shell-muted">TLÜ ürituste aja- ja ruumiotsing</span>
        </span>
      </Link>
      <nav aria-label="Peamenüü" className="ml-auto flex items-center">
        <Link href="/" className="px-4 py-3 text-sm text-shell-muted hover:bg-secondary hover:text-shell-ink">
          Uus otsing
        </Link>
      </nav>
      <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-xs text-shell-muted sm:inline">
        Anonüümne sessioon · kontot pole vaja
      </span>
    </header>
  );
}
