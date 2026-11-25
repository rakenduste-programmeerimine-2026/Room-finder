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

Tiimil on **üks ühine hostitud Supabase'i projekt** (Vercel'i preview ja
produktsioon). Kontot kasutaja ei loo: rakendus kasutab Supabase'i anonüümset
sisselogimist, nii et iga brauser saab oma kasutaja ID ja RLS näitab igaühele
ainult tema enda gruppe ja otsinguid. Andmemudel: [`docs/data-model.md`](docs/data-model.md).

#### Ühendamine (iga tiimiliige)

1. Kopeeri `.env.example` → `.env.local`.
2. Küsi andmebaasi rollilt hostitud projekti URL ja **publishable key** ning
   pane need `.env.local`-i (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Kohaliku Supabase'i
   (`npx supabase start`, vajab Dockerit) väärtused annab `npx supabase status`.
3. **Secret key (`sb_secret_…`) ega `service_role` võtit ei panda kunagi
   `.env.local`-i, repo'sse ega kliendikoodi.** Seda kasutab ainult serverikood
   keskkonnamuutujast.

#### Andmebaasi skeem

| Tabel          | Sisu                                                                |
| -------------- | ------------------------------------------------------------------- |
| `rooms`        | Ruumide kataloog; kliendid ainult loevad                            |
| `saved_groups` | Kasutaja salvestatud ruumi- ja õppekavagrupid eelisjärjestusega     |
| `searches`     | Otsingu sisendite koopia, staatus ja tulemus (tulemuse kirjutab server) |

Pilveprojektis on praegu **näidisruumid koodidega `DEMO-…`**
([`supabase/seed.sql`](supabase/seed.sql)). Need jäävad sinna seni, kuni backend
täidab päris ruumide kataloogi (`docs/data-model.md`, Q9).

#### Uus migratsioon

1. Loo fail `supabase/migrations/<YYYYMMDDHHMMSS>_<kirjeldus>.sql`
   (nt `npx supabase migration new add_x`). Olemasolevaid migratsioone, mis on
   juba pilve rakendatud, ei muudeta – tee uus.
2. Lisa testid kausta `tests/db/` (piirväärtused, RLS) ja käivita `npm test`.
3. Skeemi muudatused käivad ainult migratsioonidena ja läbi PR-i; Supabase'i
   dashboard'is otse muudatusi ei tehta.

#### Migratsioonide rakendamine pilve (andmebaasi roll)

Enne PR-i liitmist, sest liitmine deploy'b:

```bash
npx supabase login
npm run db:link                     # vali tiimi projekt
npm run db:push -- --include-seed   # migratsioonid + DEMO-ruumid (seed on idempotentne)
npm run db:types                    # uuendab src/lib/supabase/database.types.ts
```

#### Andmebaasi testid

`npm test` käivitab ka `tests/db/` testid: need rakendavad kõik migratsioonid
ja seed'i PGlite'is (Postgres mälus, `tests/db/supabase-stub.sql` asendab
Supabase'i rolle ja `auth.uid()`). Dockerit ega päris Supabase'i pole vaja;
testid jooksevad ka CI-s.

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
