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

## Decisions taken while building (all from the "simplest option that serves the learning goals" rule)
Status: **M1-M7 done.** The user said to decide everything; these are the calls made.

1. **Crew of 4.** The brief lists "crew of 4 (player + Layan, Omar, Maya, Kenji)" which is 5 names. Crew = you + Layan + Omar + Maya (consumption 4/day, as the table says). **Kenji is Mission Control on Earth** (he appears in the "message from home" situation).
2. **Habitat stores.** The habitat starts with 12 oxygen (brief) **and also 12 water and 12 food** (3 days of each), so a bad cargo fails on day 3-4 instead of on day 1. Everything else comes from cargo. The battery starts full.
3. **Max per item** (`items.json`): needed so the balance script can enumerate cargos. Solar 4, battery 4, reactor 1, generator 1, o2 tank 6, recycler 1, water tank 6, food 8, greenhouse 1, shield 1, excavator 1, shelter 1, spares 3. 531,274 cargos fit in 20 mass.
4. **Shielding vs. cosmic rays** (brief: "helps a lot against storms but little against cosmic rays"): storm dose uses the shield factor in full; the daily cosmic dose uses `1 - (1 - factor) * 0.5` (`cosmicShieldEffectiveness`).
5. **Radiation numbers.** The 100 mSv limit is a game rule (the real NASA career limit, 600 mSv, is shown as a fact). Storm dose 70 mSv is a game value. Storm cover: shelter x0.1, hiding behind the habitat x0.5, none x1.0.
6. **Oxygen end check.** Evacuate when the crew could not get its full oxygen, or when 0 is left and the mission is not finished; day 30 with a clean finish is a success.
7. **Situations.** Darkness (days 9, 21) and the storm (day 12-20) are always there; 4-6 more are drawn from the 8 random ones that apply to the packed cargo (recycler breakdown needs a recycler, meteoroid/dust need panels, mold needs a greenhouse). No two situations on neighbouring days. Each situation has exactly two choices with a stated cost, hands-on ones become a walk-and-hold task, and the day's default choice applies if time runs out.
8. **Spare parts** fix a broken recycler or cracked panels at any time (not only on the day it breaks). Without a spare the recycler is patched by the crew after 3 days of rationing; cracked panels stay at half output.
9. **Stars.** Success: 2 stars, 3 if crew health >= 70, dose <= 70 and morale >= 50. Evacuation: 1 star, 2 if it happened on day 20 or later. Science stars are shown separately.
10. **Real-time.** 1 day = 20 s (`secondsPerDay`); the clock pauses while any panel/card is open, during the landing, and while the storm countdown runs. `?daysec=N` shortens days for testing.
11. **Facts.** Only the six facts in the brief plus four we found with real sources (lunar dust, micrometeoroids, ISS family video calls, ISS sleep schedule) and three stories (Apollo 13, the August 1972 storm, Opportunity). Where a source is a news page repeating NASA material it is flagged `secondary` in `facts.json` and in Scientist mode. The Apollo 13 story links to Wikipedia because nasa.gov was not reachable from the build machine (marked `todo` in `facts.json`).
12. **Balance targets.** Final run (531,274 cargos x 200 seeds, see README): best cargo 90.5 % and none above 95 % (target met); thoughtful cargos 82.1 % (met); random cargos 0.6 % against a 20-30 % target (**not met**). With the brief's own numbers 18 of the 20 mass units are needed just for consumables, so blind random cargos almost never survive. We kept the brief's numbers (that tension is the lesson) and added Radar's plan check on the pack screen (a dry run of a quiet mission that says what runs short and when), Easy mode with a working suggested cargo, and fast failure (a bad cargo ends in days). The README says which knobs make random play gentler.
13. **Default language:** the browser language (Arabic if it starts with "ar", otherwise English), remembered in localStorage; `?lang=ar|en` overrides it.
