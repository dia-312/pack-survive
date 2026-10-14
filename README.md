# Pack & Survive

A Moon-base mission trainer for kids aged 9-13, made for **NASA Space Apps 2026**
(challenge: *Junior Astronaut Mission Trainer*).

You are the commander of a crew of four. Earth sends one small lander (20 mass units).
Pack it, watch the **launch from Earth, the trip and the Moon landing**, then explore the base
**in first person, in 3D**: walk, run and jump in Moon gravity, and keep everyone alive for 30 days:
power, oxygen, water, food and radiation all pull on the same tiny budget.
Nobody dies in this game. If things go wrong the crew is **evacuated** and flies home safe.

Arabic and English (RTL), desktop and phone, no backend.

## What kids learn
1. **Every kilogram counts**: the lander only holds 20 mass units.
2. **Power runs everything**: air, water, food and heat all need power; the dark days show why.
3. **Spares save missions**: one spare part can decide between finishing and evacuating.
4. **Radiation adds up**: it is invisible and cumulative; a shelter protects from solar storms.

The report screen names the **turning point** of the mission, links it to a **real space story**
(Apollo 13, the August 1972 solar storm, the Mars rover Opportunity...), gives a tip, and asks three
questions: the hardest choice, why it ended that way, and what you learned about living on the Moon.

## Run it
```bash
npm install
npm run dev        # play at http://localhost:5173
npm test           # 79 Vitest tests (engine, difficulty, data files, translations)
npm run balance    # cargo balance report, Challenge rules (see below)
npm run balance -- --difficulty easy   # the same for Easy mode
npm run build      # static site in dist/
```

Handy address parameters:

| Parameter | Effect |
|-----------|--------|
| `?lang=ar` / `?lang=en` | start in that language |
| `?seed=123` | replay exactly the same mission (storm day, situations...) |
| `?daysec=5` | make a mission day 5 seconds instead of 20 (for testing) |

Controls (desktop): **WASD** walk (arrow keys walk and turn), **click** the view then move the **mouse** to look,
**Space** jump, **Shift** run, **E** opens the module you stand next to (a quick tap) or, **held** near a glowing ring,
repairs, cleans, patches or scans. Phones: left stick to walk, drag on the right to look, **Jump / Run / Action** buttons.
Time pauses while a panel or card is open. The cut-scene can be skipped.

**Easy mode** is on by default (bigger habitat stores, gentler storms, fewer surprises). Turn it off on the start
screen for the full "Challenge" rules from the brief.

## Deploy (Vercel or any static host)
`npm run build` writes a static site to `dist/` (relative asset paths, so it works from any sub-folder).

* **Vercel**: import the repository, framework preset *Vite*, build command `npm run build`, output directory `dist`. No environment variables.
* **Anything else** (GitHub Pages, Netlify, an S3 bucket...): upload the contents of `dist/`.

three.js (about 130 kB gzipped) is loaded only when you press Launch, so the start, briefing and pack screens open fast.

## How it is built
* **Vite + TypeScript.** three.js draws the first-person Moon base and the cut-scene; React draws the HUD, panels, cards and menus (so Arabic text renders correctly).
* `src/engine` - the simulation in pure TypeScript (no three.js/React): seeded RNG (mulberry32), daily tick, end checks, situations, scoring, cargo plan. Tested with Vitest.
* `src/game` - the day clock / situations / tasks (`controller.ts`), the base layout in metres (`layout.ts`) and `world/`: terrain height field with craters, models built from primitives, canvas-painted textures, the first-person `MoonBase` and the `Cutscene`.
* `src/ui` - React overlay: screens, HUD, module panels, situation cards, report, joystick.
* `src/data` - `params.json` (including the `difficulty.easy` overrides), `items.json`, `events.json`, `facts.json`. Balance values live here, not in code.
* `src/i18n` - `en.json`, `ar.json`. All text goes through `t()`; a test checks both files have the same keys and that every key used in the code exists.
* `scripts/balance.ts` - plays every cargo within 20 mass over many seeds.

All art is made in code (three.js primitives, textures painted on canvases at start-up, inline SVG). The mascot **Radar** is an original character. No NASA logo, no copyrighted characters.
Palette: navy `#14213D`, cream `#F6F3EC`, orange `#F28C28`, blue `#3FA7D6`, light blue `#8FD3F0`, Moon gray `#C9C2B3`.

### The daily tick (in this order)
1. Produce power: panels x sun factor + reactor.
2. Distribute by priority: base (2/day) -> oxygen generator -> water recycler -> greenhouse -> excavator. Surplus charges the battery (`B(t+1) = min(C, B(t) + P(t) - D(t))`), a deficit drains it; when it is empty the lowest-priority systems shut off and an alert appears.
3. Run the powered systems.
4. The crew uses 4 oxygen, 4 food and 4 water (minus what the recycler recovers).
5. Radiation: daily dose x shield factor, or the storm dose.
6. Health: no food -10, no water -20, base unpowered -5, otherwise +5 (up to 100).
7. End checks: oxygen -> evacuation, any crew member at 0 health -> medical evacuation, dose over the game limit -> early evacuation, day 30 -> success.

Sun factor is 1.0 except 0 on days 9-11 and 21-23. Shield factor: level 0 = 1.0, 1 = 0.7, 2 = 0.5, 3 = 0.35.
See `PLAN.md` for every design decision and assumption.

### Situations (each ends with a real "Did you know?" fact)
Darkness (days 9 and 21), solar storm (run to the shelter in 20 s), water recycler breakdown, micrometeoroid on the panels,
sticky dust (hold to clean), small air leak (hot/cold hint), moldy greenhouse, strange rock (scan it), message from home, tired crew.
Each has two choices and every choice has a cost. 4-6 of the random ones are drawn per mission by the seed.

### Facts and sources
Facts live in `src/data/facts.json`, in Arabic and English, each with a real source. **Scientist mode** (a toggle) shows the exact values and source links.
Where a source is a news page that repeats NASA material it is marked "secondary". Nothing is invented:
the 100 mSv limit and the storm dose are *game rules* and are labelled that way (the real NASA career limit, 600 mSv, is a fact).

## Balance report

`npm run balance` plays **every cargo that fits in 20 mass units** (531,274 of them, using the per-item maximums in
`items.json`) over **200 seeds** each with a simulated commander: sensible choices on every card, but
hands-on tasks (run to the shelter, find the leak, scan the rock...) only succeed 85 % of the time, like a real kid.
Use `npm run balance -- --seeds 20 --sample 4` for a quick look (about 20 seconds).
That is 106 million missions in about 14 minutes on 4 cores. Output of the final build:

```text
Cargos within 20 mass: 531274. Seeds: 200. Threads: 4.
Simulated 106,254,800 missions in 848.0 s.

Summary (target in brackets)
  blind random fill (any items, 224229 cargos):          0.3 %
  random cargo (random fill that names power+air+water+food, 95023):  0.6 %   [20-30 %]
  thoughtful cargo (checklist, 5 cargos):          82.1 %   [75-85 %]
  best single cargo:                                  90.5 %   [no cargo above 95 %]
  cargos above 95 %:                                  0   [0]
  cargos with 75 %+ success:                          404 (reactor 199, solar+battery 205, no power plant 0, no generator 104)
  cargos that never succeed:                          529975 of 531274

Top 10 cargos
   1.  90.5 %  mass 20  reactor×1 o2tank×6 recycler×1 food×4 excavator×1
   2.  90.5 %  mass 20  battery×1 reactor×1 o2gen×1 recycler×1 watertank×2 food×4 excavator×1
   3.  90.5 %  mass 20  reactor×1 o2gen×1 recycler×1 watertank×2 food×4 shield×1
   4.  89.5 %  mass 20  reactor×1 o2gen×1 o2tank×1 recycler×1 watertank×2 food×4 greenhouse×1
   5.  88.5 %  mass 20  reactor×1 o2gen×1 o2tank×1 recycler×1 watertank×2 food×5 shelter×1
   6.  88.5 %  mass 17  reactor×1 o2gen×1 o2tank×1 recycler×1 watertank×2 food×4
   7.  88.5 %  mass 18  reactor×1 o2gen×1 o2tank×1 recycler×1 watertank×2 food×4 spare×1
   8.  88.5 %  mass 18  reactor×1 o2gen×1 o2tank×1 recycler×1 watertank×2 food×5
   9.  88.5 %  mass 18  reactor×1 o2gen×1 o2tank×1 recycler×1 watertank×3 food×4
  10.  88.5 %  mass 18  reactor×1 o2gen×1 o2tank×2 recycler×1 watertank×2 food×4

How often each item appears in the top 10 cargos
  solar                  0/10
  battery     #          1/10
  reactor     ########## 10/10
  o2gen       #########  9/10
  o2tank      ########   8/10
  recycler    ########## 10/10
  watertank   #########  9/10
  food        ########## 10/10
  greenhouse  #          1/10
  shield      #          1/10
  excavator   ##         2/10
  shelter     #          1/10
  spare       #          1/10

How often each item appears in the best 0.1 % of cargos (531 cargos)
  solar        62.3 %
  battery      27.9 %
  reactor      42.4 %
  o2gen        72.7 %
  o2tank       72.9 %
  recycler     91.1 %
  watertank    94.5 %
  food        100.0 %
  greenhouse    1.3 %
  shield        0.4 %
  excavator    10.9 %
  shelter       9.2 %
  spare        58.2 %
```

How to read it against the targets in the brief:

| Target | Result | |
|--------|--------|---|
| No cargo above 95 % | best cargo **90.5 %**, 0 cargos above 95 % | met |
| Thoughtful cargo 75-85 % | **82.1 %** (cargos that do the sums for power, air, water, food and have some storm cover) | met |
| Random cargo 20-30 % | **0.6 %** for a random fill that names power + air + water + food (0.3 % for a blind fill) | **not met** |

Why the random target is missed: with the consumption numbers in the brief (4 oxygen + 4 water + 4 food a day for 30 days,
tanks and crates of 20) the *consumables alone* weigh about 18 of the 20 mass units, so a random
cargo almost never has enough of everything. We kept the brief's numbers on purpose (that tension *is* the lesson "every
kilogram counts") and instead made the puzzle approachable: Radar's plan check on the pack screen runs a quiet dry-run mission
and tells the kid which supply runs short and on which day, Easy mode offers a cargo that works, and a failed cargo ends within
days, so a retry is fast. If you want a gentler random-play rate, the knobs are the tank/crate sizes in `src/data/items.json`
(doubling them gives roughly 10 % for random cargos) and the health penalties in `params.json`; rerun `npm run balance` after changing them.

What the best cargos look like: a reactor (power day and night, so the dark days cost nothing), an oxygen generator or oxygen tanks,
a recycler, enough water and 4-5 food crates, plus one safety item (excavator, ready-made shield, shelter or a spare part).
Solar + 3 batteries also works but is more fragile (dust, micrometeoroids, the 3-day dark spells).


## Accessibility
Status is always icon + color + shape (never color alone). Touch targets are at least 44 px.
Dialogs are keyboard-reachable (Esc closes). `prefers-reduced-motion` is respected.
The report chart has direct labels and a table view.

## License
Prototype for NASA Space Apps 2026. All code and art in this repository are original.
