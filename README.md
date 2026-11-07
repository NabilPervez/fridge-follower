# fridge-follower

Local-first meal planning PWA: plan five meals a day, track fridge levels with one tap, and build the shopping list from what's planned minus what's already stocked. Works offline. Data stays on the device.

- `app/` holds the app (Vite + React + TypeScript + Dexie). See [app/README.md](app/README.md) to run, test and build it.
- `project/` and `chats/` hold the original Claude Design prototype and conversation. [HANDOFF.md](HANDOFF.md) explains the bundle.
- `netlify.toml` builds `app/` and publishes `app/dist`.

## Family Table sync (Nov 2026)
Settings → **Share with Family Table** joins the same household as the Family Table app (code + passphrase).
- Fridge levels are pushed to Family Table (`/api/sync/fridge`) so its grocery list marks stocked items "In the fridge".
- Family Table's weekly grocery list appears on **Shop → From Family Table**; checking an item syncs back.
- Local-first is unchanged: everything still works offline and without joining. Contract: `family-table/docs/sync.md`.
