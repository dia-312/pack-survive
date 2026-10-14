# Pack & Survive

A Moon-base mission trainer for kids aged 9-13, made for **NASA Space Apps 2026**
(challenge: *Junior Astronaut Mission Trainer*).

You are the commander of a crew of four. Earth sends one small lander (20 mass units).
Pack it, land, then **walk around a 2D Moon base** and keep everyone alive for 30 days:
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
npm test           # 76 Vitest tests (engine, data files, translations)
npm run balance    # cargo balance report (see below)
npm run build      # static site in dist/
```

Handy address parameters:

| Parameter | Effect |
|-----------|--------|
| `?lang=ar` / `?lang=en` | start in that language |
| `?seed=123` | replay exactly the same mission (storm day, situations...) |
| `?daysec=5` | make a mission day 5 seconds instead of 20 (for testing) |

Controls: **WASD / arrows** to walk, **E / Space** to open the module you stand next to (a quick tap),
or **hold** it near a glowing ring to repair, clean, patch or scan. On phones: the joystick and the big
action button. Time pauses while a panel or card is open.

## Deploy (Vercel or any static host)
`npm run build` writes a static site to `dist/` (relative asset paths, so it works from any sub-folder).

* **Vercel**: import the repository, framework preset *Vite*, build command `npm run build`, output directory `dist`. No environment variables.
* **Anything else** (GitHub Pages, Netlify, an S3 bucket...): upload the contents of `dist/`.

Phaser (about 340 kB gzipped) is loaded only when the lander touches down, so the start, briefing and pack screens open fast.

## How it is built
* **Vite + TypeScript.** Phaser 3 draws the explorable map; React draws the HUD, panels, cards and menus (so Arabic text renders correctly).
* `src/engine` - the simulation in pure TypeScript (no Phaser/React): seeded RNG (mulberry32), daily tick, end checks, situations, scoring, cargo plan. Tested with Vitest.
* `src/game` - Phaser scene (`BaseScene`), the day clock / situations / tasks (`controller.ts`), art drawn in code (`art.ts`), map layout.
* `src/ui` - React overlay: screens, HUD, module panels, situation cards, report, joystick.
* `src/data` - `params.json`, `items.json`, `events.json`, `facts.json`. Balance values live here, not in code.
* `src/i18n` - `en.json`, `ar.json`. All text goes through `t()`; a test checks both files have the same keys and that every key used in the code exists.
* `scripts/balance.ts` - plays every cargo within 20 mass over many seeds.

All art is made in code (Phaser Graphics textures and inline SVG). The mascot **Radar** is an original character. No NASA logo, no copyrighted characters.
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

<!--BALANCE-->

## Accessibility
Status is always icon + color + shape (never color alone). Touch targets are at least 44 px.
Dialogs are keyboard-reachable (Esc closes). `prefers-reduced-motion` is respected.
The report chart has direct labels and a table view.

## License
Prototype for NASA Space Apps 2026. All code and art in this repository are original.
