# Fridge Follower

Local-first meal planning PWA: plan five meals a day, track fridge levels with one tap, and build a shopping list from the next seven days of meals minus what's already stocked. Everything is stored on the device in IndexedDB. There is no account and no server.

Built from `../project/Fridge Follower v2.dc.html` (the Claude Design prototype) and the PRD in `../chats/chat1.md`.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit + data-layer tests (fake-indexeddb)
npm run build      # type-check + production build with service worker
npm run preview    # serve the build (service worker active)
```

## Stack

Vite · React 19 · TypeScript · React Router · Zustand (UI state) · Dexie + `useLiveQuery` (data) · vite-plugin-pwa (Workbox, auto-update) · Phosphor icons · Geist + Space Grotesk, self-hosted via Fontsource.

## Layout

| Path | What |
| --- | --- |
| `src/data/db.ts` | Dexie schema v1 (PRD §5.3). Never edit v1 after release; add `version(2)` with an upgrade. |
| `src/data/actions.ts` | Every write. Each runs in one transaction through `record()`, which returns an `undo()` for the toast. |
| `src/data/recorder.ts` | Undo snapshots. Read its comments before adding writes: inside a Dexie transaction, never `await` something that does no IndexedDB work. |
| `src/domain/shopping.ts` | List generation (PRD §5.5), including the "may run short" heuristic. |
| `src/domain/parse.ts` | On-device recipe text/JSON import. |
| `src/data/backup.ts` | JSON export (Web Share, falling back to download) and restore (validate → preview → Replace or Merge). |
| `src/pages/`, `src/sheets/` | Screens and bottom sheets, matching the prototype. |
| `src/styles.css` | Design tokens and component styles. Dark theme only for now. |

## Notes and deviations from the prototype

- Five tabs (Today · Plan · Recipes · Fridge · Shop). Settings opens from Today.
- Real dates. Plan has previous/next week buttons. The shopping list covers today plus the next 6 days.
- First launch is empty. A welcome card offers the starter pack, which contains the prototype's sample kitchen.
- The list is flagged out of date when the plan or recipes change, or when an item crosses its low threshold.
- Plan entry IDs are `date|slot` so each slot holds exactly one entry.
- Not built yet: light theme, the wide 7-column week view (≥768px), onboarding screens, Android TWA packaging (Bubblewrap + `assetlinks.json`).
