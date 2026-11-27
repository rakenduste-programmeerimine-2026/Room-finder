import { SearchForm } from "./_components/search-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-8 md:px-12">
      <SearchForm />
    </main>
  );
}
