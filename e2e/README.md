# End-to-end tests (Playwright)

We use **Playwright** for end-to-end tests (Angular's old Protractor is end-of-life;
Playwright is fast, multi-browser and drives the real app + API).

## One-time setup

```bash
npm install                 # installs @playwright/test (already in devDependencies)
npx playwright install      # downloads the browser binaries
```

## Running

`ng serve` is started automatically (reused if already running). The **smoke**
suite only needs the frontend:

```bash
npm run e2e            # headless
npm run e2e:ui         # interactive UI mode
npm run e2e:report     # open the last HTML report
```

### Full creator + buyer journey

`journey.spec.ts` exercises the whole flow — register → inspect the demo
blueprint → create & publish a free dummy tour → acquire it → check the library →
delete it. It needs the **backend + database** running (the dev proxy sends
`/api` → `http://localhost:3000`). It's gated so it doesn't fail the default run:

```bash
# start the backend stack (e.g. docker-compose up) first, then:
E2E_FULL=1 npm run e2e
```

The dummy tour it builds mirrors `src/app/features/studio/demo-tour.ts` — text
and image placeholders only, no audio — and is deliberately disposable so the
run can repeat. The same fictional tour is always visible read-only in every
Studio under **Studio → Demo tour** (`/studio/blueprint`).

## Useful env vars

| Var             | Effect                                                        |
|-----------------|--------------------------------------------------------------|
| `E2E_FULL=1`    | Run the full backed journey (otherwise skipped).             |
| `E2E_BASE_URL`  | Point at a different base URL (default `http://localhost:4200`). |
| `E2E_NO_SERVER=1` | Don't auto-start `ng serve` (you're running it yourself).   |

> Note: the journey's selectors lean on visible text/labels. If you change the
> publish/delete copy or the auth form, tweak `journey.spec.ts` accordingly.
