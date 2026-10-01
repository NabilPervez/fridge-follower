# fridge-follower

Local-first meal planning PWA: plan five meals a day, track fridge levels with one tap, and build the shopping list from what's planned minus what's already stocked. Works offline. Data stays on the device.

- `app/` holds the app (Vite + React + TypeScript + Dexie). See [app/README.md](app/README.md) to run, test and build it.
- `project/` and `chats/` hold the original Claude Design prototype and conversation. [HANDOFF.md](HANDOFF.md) explains the bundle.
- `netlify.toml` builds `app/` and publishes `app/dist`.
