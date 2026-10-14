# CLAUDE.md — Pack & Survive

Web game for NASA Space Apps 2026, challenge "Junior Astronaut Mission Trainer".
Kids aged 9–13 command a 30-day Moon-base mission and feel the engineering trade-offs
(life support, radiation shielding, power, food). Educational first, fun second.

## Non-negotiable rules
- **Never scary.** Nobody dies. Failure = emergency evacuation; the crew always gets home safe.
- **Every mechanic serves a learning goal:** (1) every kg counts, (2) power runs everything,
  (3) spares save missions, (4) radiation adds up.
- **Every situation** has exactly 2 choices, each with a cost, and ends with a "Did you know?" fact.
- **Never invent numbers or facts.** Facts live in `src/data/facts.json` with a real source URL.
  If a fact is missing, add a clearly marked `TODO` — do not make one up.
- Kid wording in normal play; exact values + source links only in **Scientist mode** (toggle).
- Nothing relies on color alone: status = icon + color + shape.

## Architecture
- **Vite + TypeScript.** Phaser 3 = explorable map. React = overlay (HUD, panels, cards, menus).
- `src/engine/` — pure TypeScript simulation + Vitest tests. **No Phaser/React imports. No `Math.random`**
  (use the seeded `mulberry32` RNG so a seed replays exactly).
- `src/game/` — Phaser scenes. `src/ui/` — React overlay. `src/i18n/` — `ar.json`, `en.json`.
- `src/data/` — `params.json`, `items.json`, `events.json`, `facts.json`. Balance values live here, not in code.
- `scripts/balance.ts` — enumerates all cargos ≤ 20 mass over 200 seeds.
- Phaser ↔ React talk through a small typed event bus; the engine state is the single source of truth.

## Simulation (daily tick, in this order)
1. Produce power (panels × sun factor + reactor)
2. Distribute by priority: base (2/day) → oxygen gen → water recycler → greenhouse → excavator;
   surplus charges battery, deficit drains it; empty battery → lowest-priority system shuts off + alert
3. Run powered systems
4. Crew uses 4 oxygen, 4 food, 4 water (minus recycler recovery)
5. Radiation: daily dose × shield factor, or storm dose
6. Health: no food −10, no water −20, unpowered base −5; otherwise +5 (cap 100)
7. End checks: O₂ 0 → evacuation; any health 0 → medical evacuation; dose > 100 mSv → early evacuation; day 30 → success

`B(t+1) = min(C, B(t) + P(t) − D(t))` · Shield factor: L0 1.0, L1 0.7, L2 0.5, L3 0.35 ·
Sun factor 1.0 except 0 on days 9–11 and 21–23 · 1 mission day = 20 s real time (param) ·
time pauses while any panel/card is open · max 1 new situation/day, 4–6 per run.

## Conventions
- All user-visible text goes through i18n (Arabic RTL + English). Switch `dir` on the overlay root; use logical CSS properties.
- All art generated in code (Phaser Graphics → textures, or inline SVG). Original characters only (mascot: robot "Radar"). No NASA logo, no copyrighted characters.
- Palette: navy `#14213D`, cream `#F6F3EC`, orange `#F28C28`, blue `#3FA7D6`, light blue `#8FD3F0`, Moon gray `#C9C2B3`.
- Fonts: Fredoka + Nunito (EN), Tajawal / IBM Plex Sans Arabic (AR), with system fallbacks.
- Mobile: on-screen joystick + big action button, touch targets ≥ 44 px, smooth on a mid-range phone.
- No backend. Best score in `localStorage` (always wrapped in try/catch).

## Handy facts for working on it
- Address params: `?lang=ar|en`, `?seed=N` (replay a mission), `?daysec=N` (shorter days for testing).
- Dev server only: `window.__pack` exposes `getState`, `setState`, `startMission`, `controller` (`controller.debug.teleport(x, y)`, `controller.view.task`) for scripted tests and screenshots.
- Phaser never renders Arabic text; all text is React DOM. The mascot is Radar (original), crew = you + Layan + Omar + Maya, Kenji = Mission Control.
- Decisions and assumptions are recorded in `PLAN.md` ("Decisions taken while building").
- A test (`src/engine/i18n.test.ts`) fails if `ar.json` and `en.json` differ or a `t('key')` used in code is missing.

## Workflow
- Build milestone by milestone (see `PLAN.md`); **run tests and commit after each milestone**.
- Commands: `npm run dev` · `npm test` · `npm run balance` · `npm run build` (static, Vercel-ready).
- Ambiguity → pick the simplest option that serves the learning goals and record it in `PLAN.md`.
