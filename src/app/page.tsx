import { SearchForm } from "./_components/search-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-8 md:px-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-normal">Uus otsing</h1>
        <p className="text-sm text-ink-muted">Kõik ajad on Tallinna aja järgi.</p>
      </div>
      <SearchForm />
    </main>
  );
}
