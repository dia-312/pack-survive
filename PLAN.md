# PLAN — Pack & Survive (prototype)

Goal: a kid can pack, land, walk around, handle ≥ 5 different situations, and finish or evacuate in ~10 minutes
(30 days × 20 s = 10 min of real time), in Arabic and English, on desktop and phone, from one `npm run build`.

## Stack
Vite + TypeScript · Phaser 3 (map) · React (overlay) · Vitest (engine) · `tsx` (balance script) · i18n via small JSON dictionaries.

## File layout
```
src/
  engine/          pure sim — rng.ts, types.ts, state.ts, tick.ts (power, distribute, consume, radiation,
                   health, endChecks), events.ts (situation scheduler), score.ts (stars, turning point),
                   cargo.ts (mass check, suggested cargo), *.test.ts
  data/            params.json, items.json, events.json, facts.json
  game/            BootScene, BaseScene (map, player, NPCs, modules), entities/, interactions.ts,
                   textures.ts (code-drawn art), eventBus.ts
  ui/              React: App, StartScreen, Briefing, PackScreen, HUD, ModulePanel, SituationCard,
                   Report (chart + 3 questions), Joystick, ActionButton, ScientistToggle
  i18n/            ar.json, en.json, useI18n.ts
scripts/balance.ts
PLAN.md  CLAUDE.md  README.md
```

## Milestones (tests + commit after each)
| # | Scope | Done when |
|---|-------|-----------|
| M1 | Engine, data JSON, seeded RNG, Vitest for every tick step and end check, `scripts/balance.ts` | `npm test` green; balance prints top-10 cargos + item frequency and hits targets (random 20–30 %, thoughtful 75–85 %, none > 95 %) |
| M2 | Pack screen: item grid, mass meter (red + launch blocked when > 20), easy-mode suggested cargo, start/briefing flow, landing animation | Can pack and launch; over-mass blocked |
| M3 | Phaser map ~3–4 screens wide, camera follow, WASD/arrows, module slots for packed items only, NPC crew, "E / tap" prompt | Walk freely, approach modules, prompt appears |
| M4 | Day cycle (20 s/day param), pause while panel open, skip-day button, HUD, module panels (status/gives/needs/switch/actions/fact), darkness dimming, crew face icons | A full uneventful mission runs end to end |
| M5 | Situations: **solar-storm run-to-shelter first**, then darkness, recycler breakdown, meteoroid, dust (hold 3 s), air leak (hot/cold), moldy plants, strange rock, message from home, tired crew | ≥ 5 situations playable; each ends with a fact |
| M6 | Mission report: result + day, 1–3 stars, resource chart, turning point + real story, tip, 3 reflection questions, "Repack and retry" (keeps cargo), best score in localStorage | Report shown for success and evacuation |
| M7 | Arabic/English + RTL mirroring, mobile joystick/action button, Scientist mode, polish, README (run, deploy to Vercel, balance output) | Acceptance list below passes |

## Key design decisions / assumptions (simplest option that serves learning goals)
- **Starting stocks:** only what is packed, plus the habitat's 12 oxygen. Battery starts full (capacity = 10 × batteries packed; 0 if none → power must be live).
- **Scheduling vs. spec:** engine is deterministic given `(cargo, seed, choices)`; situations and the storm day are drawn from the seed at mission start so replays are exact.
- **Situation eligibility:** only fire when relevant (recycler breakdown only if packed, dust/meteoroid only if panels packed, mold only if greenhouse packed). Pool is filtered, then 4–6 are drawn.
- **Evacuation = soft fail:** report says "crew went home safe", never shows death. Stars: 3 = success with health/morale high and dose low; 2 = success otherwise; 1 = evacuation after day ≥ 15 or success with big costs (exact formula in `score.ts`, tuned in M6).
- **Storm without shelter:** crew hides behind habitat → fixed partial reduction (param, default 50 %); with shelter → 90 % cut. Player ignoring the alarm takes the full storm dose.
- **Scientist mode:** adds exact numbers + source links to panels/cards and the shielding note (helps a lot vs. solar storms, little vs. cosmic rays).
- **Pausing:** a global `paused` flag from the overlay stops the day timer, NPC movement and the storm countdown.
- **Rendering for perf:** pre-render all textures once, cap NPC count (4), no per-frame allocations in `update`, tilemap-free ground via tiled `TileSprite`.
- **Arabic text** is rendered only in React (DOM), never in Phaser text objects, apart from digits/icons.
- **Facts:** only the six sourced facts from the brief are used; any additional ones are `TODO` markers until a real source is added.

## Risks & mitigations
| Risk | Mitigation |
|------|-----------|
| Balance targets (random 20–30 %, thoughtful 75–85 %, none > 95 %) are hard to hit | Build the balance script in M1 before any UI; tune `params.json`/`items.json` only; "thoughtful" = heuristic cargo (power + O₂ + water + food + shelter). Report honestly if targets can't be met. |
| Phaser ↔ React state drift | Engine state is the single source of truth; Phaser only reads it and emits intents (interact, repair, move-to-shelter). |
| Arabic/RTL bugs | All text in DOM, logical CSS properties, `dir` switched at overlay root, tested in both languages each milestone. |
| Touch controls clash with page scroll/zoom | `touch-action: none` on game + joystick, large hit areas (≥ 44 px), viewport meta without user-scalable issues. |
| Mid-range phone performance | Small map, generated textures, fixed-step update, ≤ 4 NPCs, avoid shadows/filters. |
| Facts accuracy | Only brief's sourced facts; never invent; cite source in Scientist mode. |
| Session length (10 min) too long/short for kids | Day length is a param (`secondsPerDay`); skip-day button; tune after M4 playtest. |
| Tick-order bugs | One test per tick step and per end check; seed-replay test asserts identical logs. |

## Acceptance checklist (Done when)
- [ ] Pack → land → walk → ≥ 5 different situations → finish/evacuate in ~10 min
- [ ] Every situation ends with a real, sourced fact
- [ ] Report names the turning point and links it to a real space story
- [ ] Engine tests pass; balance output pasted in README
- [ ] Arabic + English, desktop + phone, single `npm run build`
- [ ] No NASA logo / copyrighted characters; all art code-generated

## Open questions for you (defaults used if no answer)
1. Start with zero water/food unless packed (default) — or give a 1-day emergency ration?
2. Language default: Arabic or English? (default: follow browser language, toggle on Start.)
3. Stars formula: OK as sketched above?
