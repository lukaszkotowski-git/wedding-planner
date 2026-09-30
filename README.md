# Wedding Planner

SaaS do planowania wesel: RSVP gości bez logowania, lista prezentów, zadania, kalendarz, eksport do Excela.
Plan produktu i implementacji: [docs/PLAN.md](docs/PLAN.md).

## Uruchomienie lokalne

Wymagania: Node 22+, Docker.

```bash
cp .env.example .env            # ustaw BETTER_AUTH_SECRET: openssl rand -base64 32
npm install
npm run services:up             # Postgres :5442, S3 (SeaweedFS) :9010, Mailpit :1035
npm run db:migrate
npm run dev                     # web: http://localhost:5173, API: :3000
```

Maile w dev trafiają do Mailpit: http://localhost:8035

## Skrypty

| Komenda | Opis |
|---|---|
| `npm run dev` | serwer (tsx watch) + Vite |
| `npm run build` | build klienta i serwera |
| `npm test` | testy (Vitest); serwer używa osobnej bazy `wedding_test`, czyszczonej przed każdym uruchomieniem |
| `npm run typecheck` | TypeScript we wszystkich pakietach |
| `npm run db:migrate` | nowa migracja Prisma (dev) |

## Deploy (Dokploy)

Aplikacja typu Dockerfile z katalogu głównego repo. Jeden kontener serwuje API i klienta na porcie 3000
i przy starcie wykonuje `prisma migrate deploy`. Zmienne środowiskowe jak w `.env.example`
(`NODE_ENV=production`, `APP_URL=https://twoja-domena`). Postgres jako osobna usługa Dokploy.
Pliki (zdjęcia prezentów) w dowolnym magazynie S3: Cloudflare R2, Garage lub SeaweedFS (`S3_*` w env).

Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER` = adres,
`SMTP_PASS` = [hasło aplikacji](https://myaccount.google.com/apppasswords). Limit ok. 500 maili/dzień.
