# Room-finder – Ruumileidja

Veebirakendus TLÜ ürituste korraldajatele, mis leiab üritusele parima aja ja
ruumi. Kasutaja koostab ruumigrupid eelisjärjestusega, sisestab võimalikud
päevad ja ajavahemikud (või laadib need CSV-failina) ning valib soovi korral
õppekavad või ained, mille tundidega üritus kattuda ei tohi. Rakendus kogub
ASIOst ruumide hõivatud ajad ja pakub välja parima aja ja ruumi.

## Tehnoloogiad

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Supabase](https://supabase.com) (andmebaas, anonüümne sisselogimine)
- [Vercel](https://vercel.com) (deploy)

## Arenduskeskkonna seadistamine

Eeldused: Node.js 24 (vt `.nvmrc`; sobib ka 22.22+) ja npm.

```bash
git clone https://github.com/rakenduste-programmeerimine-2026/Room-finder.git
cd Room-finder
npm install
npm run dev
```

Rakendus avaneb aadressil http://localhost:3000.

### Supabase

Supabase'i seadistuse juhised lisatakse eraldi issue'ga.

## Skriptid

| Käsk                    | Mida teeb                         |
| ----------------------- | --------------------------------- |
| `npm run dev`           | Arendusserver                     |
| `npm run build`         | Produktsiooni build               |
| `npm run start`         | Käivitab buildi                   |
| `npm run lint`          | ESLint                            |
| `npm run typecheck`     | TypeScripti tüübikontroll         |
| `npm test`              | Testid (Vitest, alati `TZ=UTC`)   |
| `npm run test:watch`    | Testid jälgimisrežiimis           |
| `npm run test:coverage` | Testid koos katvuse raportiga     |
| `npm run db:link`       | Seob Supabase CLI hostitud projektiga |
| `npm run db:push`       | Rakendab migratsioonid hostitud andmebaasile |
| `npm run db:types`      | Genereerib andmebaasi TypeScripti tüübid |

## Tiimi reeglid

- **Ainult UTC aeg.** Andmebaasis hoitakse aegu tüübiga `timestamptz`, testid
  ja CI jooksevad `TZ=UTC` all. Kohalikku aega näidatakse ainult kasutajaliideses.
- **Kasutajakontosid ei ole.** Kasutaja tuvastatakse Supabase'i anonüümse
  sisselogimisega.
- **Saladused ei lähe repo'sse.** `.env.local`-i ega Supabase'i secret key'd ei
  commitita kunagi. `.env.local`-i läheb ainult publishable key;
  `.env.example` on näidis.

## Töövoog

- Iga töö algab **issue'st**. Haru nimi: `<tüüp>/<issue-nr>-<lühikirjeldus>`,
  nt `feat/12-room-groups`.
- Commitid järgivad [Angular commit convention](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)'it:
  `feat(db): add room groups table`, sõnumi lõpus `Refs #12` või `Closes #12`.
- `main`-i **ei pushita kunagi** otse – kõik läheb läbi pull requesti.
- PR-id lähevad `main`-i ja vajavad vähemalt **ühe teise tiimiliikme
  ülevaatust**. Oma PR-i ei liida keegi ise.

## Rollid

| Roll               | Vastutus                                                        |
| ------------------ | --------------------------------------------------------------- |
| Database & Quality | Supabase (tabelid, migratsioonid, RLS, seed), testid, CI, Vercel |
| Backend            | ASIO kraapija, aja ja ruumi sobitamine                          |
| Frontend           | Kasutajaliides                                                  |
