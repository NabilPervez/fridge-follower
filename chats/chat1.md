# Pantry Pal meal planning

_Started 2026-09-30 13:18 UTC_

---

## User

Design a mobile app for 

PRD — "Pantry Pal" · Local-First Meal Planning PWA / TWA

Owner: Nabil Pervez · Status: Draft v1 · Date: Sept 28, 2026 Name: Fridge Follower



1. Problem Statement

Planning five eating occasions a day (breakfast, snack 1, lunch, snack 2, dinner) across a week, while knowing what's actually in the fridge, is a mental-load problem. Today the plan, the recipes, the fridge, and the shopping list live in four different places (head, notes app, the fridge itself, a scrap of paper), so food gets double-bought, forgotten, or wasted, and the grocery trip misses things. The cost is wasted money, wasted food, and repeated daily decision fatigue.



2. Goals

Plan a full day in under 60 seconds (5 slots filled from saved recipes).

Update a fridge item's level in 1 tap (Full → High → Med → Low → Out), no typing.

Generate a next-7-days shopping list in 1 tap, automatically subtracting what's already stocked.

100% offline and on-device — works in airplane mode; no account, no server.

Installable as a PWA on any phone and as an Android app (TWA) on the Play Store.

3. Non-Goals (v1)

Non-goal	Why

Cloud sync / multi-device / household sharing	Conflicts with "all saved locally"; revisit with an optional sync layer (P2)

Precise quantity tracking (grams, counts) for inventory	You asked for Full/High/Med/Low — levels are faster to maintain than exact counts

Nutrition/macro tracking	Separate initiative; data model leaves room for it (P2)

Recipe import from URLs / web scraping	Needs a server/proxy; breaks local-only

Barcode scanning	Camera + product DB lookup adds scope; P2

4. Personas & User Stories

Primary persona — The household planner (busy parent/professional, plans on Sunday, updates fridge in 5-second bursts at the fridge door).



Planning



As a planner, I want to fill each of the 5 daily slots from my recipe list so that the day is decided in advance.

As a planner, I want to copy yesterday or a whole week's plan so that I don't rebuild routines from scratch.

As a planner, I want to put a free-text item in a slot ("leftovers", "eat out") so that the plan reflects reality without needing a recipe.

Inventory



As a planner standing at the fridge, I want to tap an item to lower its level so that updates take a second.

As a planner, I want to see all Low/Out items at a glance so that I know what's urgent.

As a planner, I want to add a new item with just a name and location so that I'm not slowed down by forms.

Shopping



As a planner, I want a list built from next week's plan minus what's in stock so that I buy only what I need.

As a planner, I want Low/Out staples auto-added so that I don't run out of basics.

As a planner in the store, I want to check items off with one tap, grouped by aisle, and have checked items restock my inventory to Full.

Recipes



As a planner, I want to save recipes with ingredients linked to inventory items so that the app knows what each meal needs.

As a planner, I want to tag recipes by slot (breakfast, snack, etc.) so that the picker shows relevant options first.

Edge cases



Empty states on first launch (no recipes, no inventory) guide the user with a "Add your first…" CTA and optional starter pack.

Recipe references an ingredient not in inventory → treated as "Out" for shopping purposes.

Deleting a recipe that's planned → plan entry keeps a snapshot name and shows "recipe deleted".

5. Technical Architecture

5.1 Stack

Layer	Choice	Rationale

Build	Vite + React 18 + TypeScript	Fast dev, matches your Marginalia/Serenity patterns

Routing	React Router (hash or history)	Simple SPA routes

State	Zustand (UI state) + Dexie useLiveQuery (data)	Live DB queries auto-rerender; no redux boilerplate

Storage	IndexedDB via Dexie.js	Structured, indexed, large capacity; localStorage is too small and synchronous

Offline	vite-plugin-pwa (Workbox)	Precache app shell, autoUpdate SW

Styling	CSS Modules or vanilla CSS with custom properties; flexbox-first layout	Per your request; no framework dependency

Icons	lucide-react	Clean, consistent line icons

Android wrapper	Bubblewrap CLI → TWA	Official Google tooling for Play Store TWAs

Hosting	Netlify (static)	Needs HTTPS origin for the TWA to verify against

5.2 Local-first honesty check ⚠️

A few things worth knowing up front, because "local only" has real consequences:



Data is only as durable as the browser storage. If the user clears Chrome site data or uninstalls, data is gone. Mitigations (all P0): call navigator.storage.persist() on first launch to request persistent storage; ship JSON export/import backup in Settings; show a "last backup" reminder after 14 days.

A TWA shares storage with Chrome for that origin. The TWA is essentially Chrome running your site full-screen, so the PWA installed from Chrome and the TWA from the Play Store point at the same IndexedDB on that device — good, not a bug. But if the user's default browser isn't Chrome, the TWA may launch via another browser with separate storage. Worth testing on a Samsung Internet default device.

TWA requires Digital Asset Links: /.well-known/assetlinks.json on your domain with the app's signing-key SHA-256 fingerprint. If it fails verification, the app shows a browser URL bar — the #1 TWA launch bug. Use Play App Signing's fingerprint, not just your upload key.

5.3 Data Model (Dexie / IndexedDB)

All IDs are crypto.randomUUID() strings. All records carry createdAt and updatedAt (ISO strings) to support future sync (P2).



// db.ts

import Dexie, { Table } from 'dexie';



export type Level = 'full' | 'high' | 'med' | 'low' | 'out';

export type Slot = 'breakfast' | 'snack1' | 'lunch' | 'snack2' | 'dinner';

export type Location = 'fridge' | 'freezer' | 'pantry' | 'spice';



export interface Item {            // an inventory item (also the ingredient master list)

  id: string;

  name: string;                    // "Greek yogurt"

  nameKey: string;                 // lowercased/trimmed for dedupe + search

  location: Location;

  category: string;                // "Dairy", "Produce"… (drives shopping aisle grouping)

  level: Level;

  isStaple: boolean;               // auto-add to shopping list when low/out

  lowThreshold: Level;             // default 'low' — at/below this triggers shopping

  unitHint?: string;               // "tub", "bag" — display only

  lastUpdated: string;

  createdAt: string; updatedAt: string;

}



export interface Recipe {

  id: string;

  name: string;

  slots: Slot[];                   // which slots it's suited for

  servings: number;

  prepMinutes?: number;

  steps?: string;                  // markdown / plain text

  tags: string[];

  favorite: boolean;

  createdAt: string; updatedAt: string;

}



export interface RecipeIngredient {

  id: string;

  recipeId: string;

  itemId: string;                  // FK -> Item

  qtyText?: string;                // "2 cups" — free text, informational

  consumes: 'none' | 'one-level' | 'depletes'; // how cooking affects inventory

  optional: boolean;

}



export interface PlanEntry {

  id: string;

  date: string;                    // "2026-09-28" (local date, no time)

  slot: Slot;

  recipeId?: string;               // either a recipe…

  freeText?: string;               // …or "Leftovers"

  nameSnapshot: string;            // survives recipe deletion

  servings: number;

  cooked: boolean;                 // marking cooked optionally decrements inventory

  createdAt: string; updatedAt: string;

}



export interface ShoppingItem {

  id: string;

  itemId?: string;                 // linked inventory item, or…

  name: string;                    // …ad-hoc ("birthday candles")

  category: string;

  source: 'plan' | 'staple' | 'manual';

  reasonRecipeIds: string[];       // "why is this on my list?"

  checked: boolean;

  listWeekStart: string;           // "2026-09-28"

  createdAt: string; updatedAt: string;

}



export interface LevelEvent {      // history log — cheap, enables future insights

  id: string;

  itemId: string;

  from: Level; to: Level;

  at: string;

  cause: 'tap' | 'shopping' | 'cooked' | 'edit';

}



export interface Setting { key: string; value: unknown; }



class FridgeFollowerDB extends Dexie {

  items!: Table<Item, string>;

  recipes!: Table<Recipe, string>;

  recipeIngredients!: Table<RecipeIngredient, string>;

  plan!: Table<PlanEntry, string>;

  shopping!: Table<ShoppingItem, string>;

  levelEvents!: Table<LevelEvent, string>;

  settings!: Table<Setting, string>;



  constructor() {

    super('fridge-follower');

    this.version(1).stores({

      items:             'id, &nameKey, location, category, level, isStaple, updatedAt',

      recipes:           'id, name, *slots, *tags, favorite, updatedAt',

      recipeIngredients: 'id, recipeId, itemId, [recipeId+itemId]',

      plan:              'id, date, [date+slot], recipeId',

      shopping:          'id, listWeekStart, checked, category, itemId',

      levelEvents:       'id, itemId, at',

      settings:          'key',

    });

  }

}

export const db = new FridgeFollowerDB();

Design notes



Item doubles as the ingredient master list — one entity, so a recipe ingredient and a fridge item are the same thing. This is what makes the shopping-list math possible.

&nameKey unique index prevents "Milk" and "milk " duplicates.

*slots / *tags are multi-entry indexes for fast filtered pickers.

[date+slot] compound index makes the Day view a single indexed query.

Migrations: every schema change = new this.version(n) with an .upgrade() callback. Never edit version 1 after release.

5.4 Level Logic

Ordered scale: full(4) > high(3) > med(2) > low(1) > out(0).



Tap on item chip → step down one level (full→high→…→out). Long-press → level picker sheet. Swipe right → set Full.

Each change writes an Item.level update + a LevelEvent in one Dexie transaction.

Marking a planned meal "cooked" (optional, setting toggle): for each ingredient where consumes='one-level', step down one level; 'depletes' → set Out.

5.5 Shopping List Algorithm

generateList(weekStart):

  entries   = plan where date in [weekStart, weekStart+6] and recipeId set and !cooked

  needed    = Map<itemId, Set<recipeId>>

  for e in entries: for ing in recipeIngredients(e.recipeId) where !optional:

      needed[ing.itemId].add(e.recipeId)



  out = []

  for (itemId, recipes) in needed:

      item = items[itemId]

      if !item or rank(item.level) <= rank(item.lowThreshold):

          out.push({itemId, source:'plan', reasonRecipeIds: recipes})

  for item in items where isStaple and rank(level) <= rank(lowThreshold) and item not in out:

      out.push({itemId, source:'staple'})



  upsert into shopping (keep existing 'manual' items and existing checked state)

Honest limitation: with levels rather than quantities, the app can't know that "Med" eggs aren't enough for four egg recipes. v1 rule: an item at Med with ≥3 planned uses is also added (flagged "may run short"). This is a heuristic — worth validating after two weeks of real use.



Checking off a shopping item → sets linked Item.level = 'full' + LevelEvent(cause:'shopping'). Undo toast for 5s.



5.6 Backup & Restore

Export: { schemaVersion, exportedAt, items, recipes, recipeIngredients, plan, shopping, settings } → fridge-follower-backup-YYYY-MM-DD.json via Web Share API (falls back to download).

Import: validate schemaVersion, preview counts, choose Replace or Merge (by id, newer updatedAt wins).

levelEvents excluded by default (can grow large); toggle to include.

6. Design System

6.1 Color — Jewel tones (dark-first, with light theme)

Token	Hex	Use

--bg	#0F1020	App background (deep ink)

--surface	#1A1B33	Cards

--surface-2	#24264A	Sheets, inputs

--text	#F3F1FA	Primary text

--text-muted	#A9A6C4	Secondary

--emerald	#0F9D76	Full, success, primary action

--sapphire	#2E5BDB	High, links, Plan accent

--amethyst	#8B3FD9	Recipes accent, focus rings

--topaz	#E3A21A	Med, warnings

--ruby	#D6264F	Low / Out, destructive

--citrine	#F2D544	Highlights, "today" marker

Level colors are also paired with text labels and a fill-bar icon so the scale isn't color-only (accessibility).



Light theme swaps --bg #F7F5FC, --surface #FFFFFF, text #17162B; jewel accents stay, darkened ~10% for contrast. All text pairs target WCAG AA (4.5:1).



6.2 Typography — modern

Display / headings: Space Grotesk (600/700)

UI / body: Inter (400/500/600), font-variant-numeric: tabular-nums for dates/counts

Scale: 12 / 14 / 16 / 20 / 24 / 32 px. Body 16px minimum (prevents iOS zoom on input focus).

Self-host fonts (woff2) in the app so they work offline — don't rely on Google Fonts CDN.

6.3 Shape, motion, touch

Radius 16px cards, 999px chips. Soft shadow + 1px rgba(255,255,255,.06) border.

Touch targets ≥ 44×44px. Primary actions in the bottom third (thumb zone).

Motion 150–200ms ease-out; respect prefers-reduced-motion.

Haptic tick (navigator.vibrate(10)) on level change where supported (Android yes; iOS Safari no).

7. Information Architecture & Pages

Bottom tab bar (4 tabs) + global floating Quick Add button.



#	Route	Page	Purpose

1	/	Today	Today's 5 slots + Low/Out alerts + shopping count

2	/plan	Week Plan	7-day × 5-slot planner

3	/plan/:date/:slot	Slot Picker (sheet)	Pick recipe / free text for a slot

4	/fridge	Inventory	All items with 1-tap level controls

5	/fridge/item/:id	Item Editor (sheet)	Name, location, category, staple, threshold

6	/shop	Shopping List	Grouped by category, check-off

7	/recipes	Recipe Library	Search, filter by slot/tag/favorite

8	/recipes/:id	Recipe Detail	Ingredients w/ live stock status, steps, "Add to plan"

9	/recipes/:id/edit	Recipe Editor	Name, slots, ingredient builder

10	/settings	Settings	Theme, backup/restore, cooked-decrements toggle, starter pack, about

11	/onboarding	Onboarding	3 screens + optional starter items/recipes

Tabs: Today · Plan · Fridge · Shop. Recipes are reached from the Plan slot picker and a header icon; Settings from the Today header. (Alternative: 5 tabs with Recipes — worth a quick hallway test.)



8. Page Layouts (Flexbox)

Global shell — every page:



.app {

  display: flex;

  flex-direction: column;

  height: 100dvh;                        /* dvh avoids mobile URL-bar jump */

  padding-top: env(safe-area-inset-top);

}

.app__header { flex: 0 0 56px; display: flex; align-items: center;

               justify-content: space-between; padding: 0 16px; }

.app__main   { flex: 1 1 auto; overflow-y: auto; display: flex;

               flex-direction: column; gap: 16px; padding: 16px; }

.app__tabs   { flex: 0 0 auto; display: flex; justify-content: space-around;

               padding-bottom: env(safe-area-inset-bottom); }

.tab         { flex: 1 1 0; display: flex; flex-direction: column;

               align-items: center; gap: 4px; min-height: 56px; }

.fab         { position: fixed; right: 16px;

               bottom: calc(72px + env(safe-area-inset-bottom)); }

8.1 Today /

[Header: "Mon, Sep 28"  ········  ⚙]

[Alert strip: 🔴 4 items low · 🛒 12 on list  →]   row, space-between

[Slot card: Breakfast | Overnight oats   ✓]       row, gap 12

[Slot card: Snack 1   | + Add]

[Slot card: Lunch     | Chicken wrap     ✓]

[Slot card: Snack 2   | Apple + PB]

[Slot card: Dinner    | Salmon bowl]

.slot-card { display:flex; align-items:center; gap:12px; } → icon flex:0 0 40px, label column flex:1 1 auto; min-width:0 (so long names ellipsize), action flex:0 0 auto.

Tap card → Slot Picker. Tap ✓ → mark cooked.

8.2 Week Plan /plan

Day selector: horizontal scroller display:flex; gap:8px; overflow-x:auto; scroll-snap-type:x mandatory; with 7 day pills flex:0 0 auto.

Below: the same 5 slot cards as Today for the selected day (consistency = learnability).

Header actions: Copy day →, Copy last week, Clear.

Tablet/wide (min-width: 768px): switch to a 7-column board — .week { display:flex; gap:12px; } .day-col { flex:1 1 0; display:flex; flex-direction:column; gap:8px; }.

8.3 Slot Picker (bottom sheet)

Sheet: display:flex; flex-direction:column; max-height:85dvh;

Search input (flex:0 0 auto, autofocus) → filter chips row (flex-wrap:wrap; gap:8px — Favorites, suited-for-this-slot, Recent) → results list (flex:1; overflow-y:auto).

Each result shows a stock dot: 🟢 all ingredients in stock / 🟡 some low / 🔴 missing.

Footer row: "Free text…" input + Save.

8.4 Inventory /fridge — the speed page

[Search………………]  [Low only ◉]

[Fridge] [Freezer] [Pantry] [Spices]      segmented, flex:1 each

── Dairy ──

[Milk          ▮▮▮▯  HIGH ]

[Greek yogurt  ▮▯▯▯  LOW  ]

.item-row { display:flex; align-items:center; gap:12px; min-height:56px; } → name flex:1 1 auto; min-width:0, level meter flex:0 0 64px, label flex:0 0 52px.

Interactions: tap = down one level · long-press = level sheet (5 big buttons in a flex row, each flex:1) · swipe right = Full · swipe left = Out.

Sort within category: Low/Out first, then A–Z.

Quick Add (FAB): single input + location chips; category auto-guessed from a built-in keyword map (e.g. "yogurt"→Dairy), editable later.

8.5 Shopping List /shop

Header: week range + Regenerate + Share list (plain text via Web Share).

Grouped by category: .group { display:flex; flex-direction:column; gap:4px; }

Row: checkbox flex:0 0 44px · name flex:1 · source badge (Plan / Staple / Manual) flex:0 0 auto. Tap a Plan badge → shows which recipes need it.

Checked items animate to a collapsed "In cart (n)" group at bottom.

Sticky footer: "Finish trip" → clears checked items, restocks all to Full.

8.6 Recipe Library /recipes

Search + slot filter chips (flex-wrap:wrap).

Card list; on ≥600px, a wrapping grid: .grid { display:flex; flex-wrap:wrap; gap:12px; } .card { flex:1 1 260px; }.

Card: name, slot tags, prep time, stock dot, ♥.

8.7 Recipe Detail / Editor

Detail: title block → ingredient list, each row showing the linked item's live level chip → steps → sticky footer "Add to plan" (opens date + slot picker).

Editor ingredient builder: type-ahead against items.nameKey; if no match, "Create 'X' as new item" inline (defaults: Pantry, Out). Row: name flex:1 · qty text flex:0 0 96px · consumes toggle · remove.

8.8 Settings

Simple flex-direction:column list of rows: Theme (System/Dark/Light) · Cooking decrements inventory (toggle) · Week starts on (Sun/Mon) · Backup now · Restore · Storage status ("Persistent ✓ / Best-effort ⚠") · Load starter pack · Reset all data (double-confirm) · Version.



9. Requirements

P0 — Must have

ID	Requirement	Acceptance criteria

R1	Offline-capable installable PWA	Lighthouse PWA installable; app loads & all CRUD works in airplane mode after first visit

R2	Inventory CRUD with 5 levels	Given an item, when I tap it, level steps down one and persists across reload; long-press opens picker; duplicate names rejected

R3	Recipe CRUD with linked ingredients	Recipe saves with ≥1 ingredient linked to an Item; unknown ingredient can be created inline

R4	Daily/weekly plan, 5 slots	Can assign recipe or free text to any slot for any date; copy day/week works

R5	Shopping list generation	Items needed by next 7 days' plan at/below threshold + low staples appear; no duplicates; manual items survive regeneration

R6	Check-off restocks	Checking a linked item sets it Full; undo within 5s reverts both

R7	Backup/restore JSON	Export → wipe → import restores identical record counts

R8	Persistent storage request	navigator.storage.persist() called; result shown in Settings

R9	TWA on Android	Launches full-screen with no URL bar; assetlinks verified

P1 — Nice to have

Cooked-decrements inventory · "May run short" heuristic · Share list as text · Starter pack · Light theme · Recipe favorites/recent sorting · Haptics.



P2 — Future (design for, don't build)

Optional encrypted sync (the updatedAt fields enable last-write-wins) · Household sharing · Macros per recipe · Barcode add · Expiry dates on items · Insights from LevelEvent ("you buy yogurt every 5 days").



10. Success Metrics (personal-use framing)

Since this is a personal/household tool, measure against your own baseline rather than adoption funnels:



Leading: median time to plan a full day < 60s; ≥ 5 inventory updates/week; shopping list regenerated weekly for 4 straight weeks.

Lagging (after 1 month): fewer "forgot X" mid-week store trips (target: from your current baseline → ≤1/week); noticeably less food thrown out (self-reported).

Measure via a local-only counter in Settings (no analytics service — keeps it truly on-device).

11. Sprint Plan (2-week sprints, solo dev + AI assistance)

Sprint 0 — Foundation (1 week)

Scope: Vite+React+TS scaffold · vite-plugin-pwa · Dexie schema v1 · design tokens (CSS variables), fonts self-hosted · app shell (header/main/tabs flex layout) · routing with placeholder pages · Netlify deploy. Definition of Done



 Deployed to Netlify over HTTPS; installs from Chrome on Android and Safari on iOS

 Works offline after first load (verified in DevTools → Offline)

 All 7 Dexie tables created; a seed script inserts and reads a record from each

 Token file contains all colors/type/spacing; dark + light render

 Lighthouse: PWA installable ✓, Accessibility ≥ 90

Sprint 1 — Inventory (the fastest-feedback feature)

Scope: Inventory page, item row, tap/long-press/swipe level changes, Quick Add FAB, Item Editor sheet, location tabs, Low-only filter, LevelEvent logging, category keyword map. Definition of Done



 Add an item in ≤ 2 taps + typing the name

 Level change in 1 tap; persists after hard reload

 Duplicate item names blocked with inline message

 Low/Out items sort to top in each category

 Every level change writes a LevelEvent in the same transaction

 Tested on a real Android and iPhone; all targets ≥ 44px

Sprint 2 — Recipes

Scope: Recipe Library, Detail, Editor, ingredient type-ahead + inline item creation, slot tags, favorites, stock-status dot. Definition of Done



 Create a 5-ingredient recipe in < 90s

 Ingredients show live inventory level; changing an item's level updates the recipe view without refresh

 Deleting an item used by a recipe prompts and handles gracefully

 Search + slot filters return correct results on a 50-recipe test set

Sprint 3 — Planning

Scope: Today page, Week Plan, Slot Picker sheet, free-text entries, copy day/week, mark cooked (+ optional decrement), name snapshots. Definition of Done



 Full day planned in < 60s from recipe library

 Copy last week duplicates 35 entries correctly with shifted dates

 Deleted recipe still shows snapshot name in plan

 Week start (Sun/Mon) setting respected everywhere

 Wide-screen 7-column layout works at ≥ 768px

Sprint 4 — Shopping List

Scope: Generation algorithm, staples, "may run short" heuristic, grouped list, source badges + reason drawer, check-off restock with undo, Finish trip, manual items, Share as text. Definition of Done



 Unit tests cover: in-stock item excluded, low item included, missing item included, staple included, no duplicates, manual items preserved on regenerate

 Check-off sets item Full; undo restores prior level and unchecks

 List generation < 200ms with 200 items / 100 recipes / 35 plan entries

 Share produces a clean, category-grouped plain-text list

Sprint 5 — Durability, Polish & TWA

Scope: Backup/restore (replace + merge), persist() request + status, 14-day backup reminder, onboarding + starter pack, empty states, reduced-motion, haptics, Bubblewrap TWA build, assetlinks.json, Play Console internal testing track. Definition of Done



 Export → clear site data → import restores all record counts exactly

 Importing a malformed file fails safely with no data loss

 Every page has a designed empty state

 TWA launches with no URL bar on a test device; assetlinks verified with Play App Signing fingerprint

 Internal testing release live on Play Console

 Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95

 One full week of real personal use with no data-loss or blocking bugs

12. Open Questions

Question	Owner	Blocking?

Will anyone else in the household update the fridge? If yes, local-only means they'd each have separate data — does that kill the idea, or is it fine for v1?	You	Yes — affects whether P2 sync moves up

Levels vs. counts: are there items (eggs, yogurt cups) where you'd actually want counts?	You	No

4 tabs + Recipes in header, or 5 tabs?	Design	No

Should planning be per person (e.g., Yusuf's snacks differ) or one household plan?	You	Soft — affects PlanEntry schema (add personId?)

iOS: no TWA equivalent; PWA only on iPhone. Acceptable?	You	No

13. References

Dexie.js docs — dexie.org

vite-plugin-pwa — vite-pwa-org.netlify.app

Bubblewrap (TWA CLI) — github.com/GoogleChromeLabs/bubblewrap

Digital Asset Links for TWA — developer.chrome.com/docs/android/trusted-web-activity

Storage persistence — developer.mozilla.org/docs/Web/API/StorageManager/persist

## Assistant

_[tool: local_ls]_

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

I've built **Fridge Follower.dc.html** as a clickable prototype in a phone frame. The "Pantry Pal" folder you attached was empty, so it's based only on your PRD's tokens and page layouts. A check of the file is still running in the background.

What works:
- **Today, Plan, Fridge and Shop** tabs. Recipes and Settings open from the header icons.
- **Fridge rows:** tap lowers the level one step, hold opens the level picker, swipe right sets Full and swipe left sets Out. Changes show a toast with Undo.
- **Planning:** tap a meal slot to pick a recipe (each shows a stock dot) or type free text. You can mark meals cooked, which lowers ingredient levels, copy a day to the next day, fill empty slots from last week, or clear a day.
- **Shopping list:** built with the PRD's rules, including staples, the "may run short" flag and manual items. Tapping a Plan badge shows which recipes need the item. Checking an item restocks it to Full with Undo; Finish trip clears the checked items. The list is marked out of date when the plan changes.
- **Recipes:** the recipe page shows each ingredient's live stock level and has an "Add to plan" button.
- **Adding items:** the + button guesses the category and blocks duplicate names.
- **Settings:** includes the backup reminder.
- **Tweaks:** switch between 4 and 5 tabs (your open question) and change fridge row density.

Caveats:
- Dark theme only. The Light option in Settings doesn't change anything yet.
- Backup, restore, share and the starter pack only show a confirmation message.
- There are no onboarding screens, recipe editor or item editor yet. The level picker has the Staple switch but no other item fields.
- It uses the name Fridge Follower from your PRD, not Pantry Pal.

Next I could do the light theme, onboarding with first-launch empty states, the recipe editor, or the wide 7-column week view.

## User

this is good. it needs to also have a way to add or import recipes. need to also have a ui for adding recipes by hand. . I need to be able to both add and reduce items in inventory. 

choose different icons.

make this app feel more modern. use jewel tones and modern libraries.

## Assistant

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

_[tool: update_todos]_

**Fridge Follower v2.dc.html** is ready, and v1 is unchanged. A background check is still running and will flag anything broken.

- **Adding recipes:** tap + on Recipes for three options:
  - **Write it by hand** opens a full editor: name, meal slots, prep time and servings, ingredients and steps. As you type an ingredient it suggests items from your inventory, or creates a new one, which starts as Out. Each ingredient has a quantity and a setting for what cooking does to it: no change, −1 level, or uses it all. You can also edit or delete a recipe from its detail page.
  - **Paste recipe text** reads the title, servings, time, ingredients and steps on the phone. "Try a sample" fills in a recipe to test it.
  - **Import a file** takes .json or .txt. A single recipe opens in the editor for review; a file with several recipes imports them all, with Undo.
- **Inventory:** every row now has − and + buttons to lower or raise its level. Tapping a row opens a sheet to pick an exact level, move it to another location, make it a staple, or delete it. Adding an item now lets you choose its starting level. Swipe still sets Full or Out.
- **Look:** new Phosphor duotone icons, with each meal slot and tab given its own jewel color. Cards are tinted glass, the tab bar floats, and the main buttons have soft glows. Sheets slide up, and motion turns off if the phone is set to reduce motion. UI text uses Geist instead of the Inter your PRD specified, with Space Grotesk for headings.

Not included: importing a recipe from a web link. Your PRD lists it as out of scope because it needs a server, so pasting the recipe text is the offline alternative. The light theme is still not built.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I fixed the Recipes filter chips (All, Favorites, Breakfast and so on), which weren't showing at all. I applied the same fix to the Plan day selector so it can't be squeezed the same way. The page loads without errors, but I didn't re-run the full check.

