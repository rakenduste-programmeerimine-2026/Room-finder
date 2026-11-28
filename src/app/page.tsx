import { SearchJourney } from "./_components/search-journey";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-8 md:px-12">
      <SearchJourney />
    </main>
  );
}
