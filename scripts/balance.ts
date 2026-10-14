/**
 * Balance check: plays every cargo within the mass budget over many seeds and reports
 *   - random cargo (the lander filled at random)   target 20-30 % success
 *   - thoughtful cargo (passes a checklist)         target 75-85 %
 *   - best cargo                                    target: none above 95 %
 * and prints the top 10 cargos plus how often each item appears in them.
 *
 *   npm run balance                 (200 seeds, all cores)
 *   npm run balance -- --seeds 20   (quick check)
 *   npm run balance -- --difficulty easy   (the kids' default rules)
 *
 * The simulated commander uses the smart policy, but hands-on actions (run to the shelter,
 * find the leak, scan the rock...) only succeed with probability SKILL, like a real kid.
 */
import { fork } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { configFor } from '../src/engine/config';
import type { Difficulty } from '../src/engine/types';

const di = process.argv.indexOf('--difficulty');
const DIFFICULTY: Difficulty = di >= 0 && process.argv[di + 1] === 'easy' ? 'easy' : 'normal';
const CONFIG = configFor(DIFFICULTY);
import { ITEM_ORDER, cargoLabel, cargoMass, enumerateCargos } from '../src/engine/cargo';
import { simulate } from '../src/engine/policy';
import { coversBasics, has, isThoughtful, kidPolicy } from './balanceLib';
import { stars } from '../src/engine/score';
import type { Cargo } from '../src/engine/types';

interface Row {
  cargo: Cargo;
  wins: number;
  starSum: number;
}

function runChunk(chunk: Cargo[], seeds: number): { wins: Uint16Array; starSum: Uint16Array } {
  const wins = new Uint16Array(chunk.length);
  const starSum = new Uint16Array(chunk.length);
  for (let i = 0; i < chunk.length; i++) {
    let w = 0;
    let st = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const s = simulate(chunk[i], seed, kidPolicy(seed), CONFIG);
      if (s.status === 'success') {
        w++;
        st += stars(s, CONFIG);
      }
    }
    wins[i] = w;
    starSum[i] = st;
  }
  return { wins, starSum };
}

const workerIdx = process.argv.indexOf('--worker');
if (workerIdx >= 0) {
  // Child process: handle every n-th cargo and report back over IPC.
  const k = Number(process.argv[workerIdx + 1]);
  const n = Number(process.argv[workerIdx + 2]);
  const seeds = Number(process.argv[workerIdx + 3]);
  const smp = process.argv.indexOf('--sample');
  const sample = smp >= 0 ? Number(process.argv[smp + 1]) : 1;
  const chunk = [...enumerateCargos(CONFIG)].filter((_, i) => i % sample === 0).filter((_, i) => i % n === k);
  const { wins, starSum } = runChunk(chunk, seeds);
  process.send!({ wins: Array.from(wins), starSum: Array.from(starSum) }, () => process.exit(0));
} else {
  void main();
}

async function main() {
  const args = process.argv.slice(2);
  const si = args.indexOf('--seeds');
  const seeds = si >= 0 ? Number(args[si + 1]) : 200;
  const sampleI = args.indexOf('--sample');
  const sample = sampleI >= 0 ? Number(args[sampleI + 1]) : 1;
  const all = [...enumerateCargos(CONFIG)].filter((_, i) => i % sample === 0);
  const threads = Math.max(1, Math.min(os.cpus().length, 8));
  console.log(`Difficulty: ${DIFFICULTY}. Cargos within ${CONFIG.params.massBudget} mass: ${all.length}. Seeds: ${seeds}. Threads: ${threads}.`);
  const t0 = Date.now();

  // Strided split so every worker gets a similar mix of cheap and expensive cargos.
  const chunks: Cargo[][] = Array.from({ length: threads }, () => []);
  all.forEach((c, i) => chunks[i % threads].push(c));
  const results = await Promise.all(
    chunks.map(
      (_, k) =>
        new Promise<{ wins: number[]; starSum: number[] }>((resolve, reject) => {
          const child = fork(fileURLToPath(import.meta.url), ['--worker', String(k), String(threads), String(seeds), '--sample', String(sample), '--difficulty', DIFFICULTY], {
            execArgv: ['--import', 'tsx'],
          });
          child.once('message', (m) => resolve(m as { wins: number[]; starSum: number[] }));
          child.once('error', reject);
        }),
    ),
  );
  const rows: Row[] = [];
  results.forEach((r, k) => chunks[k].forEach((cargo, i) => rows.push({ cargo, wins: r.wins[i], starSum: r.starSum[i] })));
  console.log(`Simulated ${(all.length * seeds).toLocaleString()} missions in ${((Date.now() - t0) / 1000).toFixed(1)} s.\n`);

  const rate = (r: Row) => r.wins / seeds;
  const mean = (xs: Row[]) => (xs.length ? xs.reduce((a, r) => a + rate(r), 0) / xs.length : 0);
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

  const isFull = (r: Row) => cargoMass(r.cargo, CONFIG) >= CONFIG.params.massBudget - 1;
  const fullRandom = rows.filter(isFull);
  const full = rows.filter((r) => isFull(r) && coversBasics(r.cargo));
  const thoughtful = rows.filter((r) => isThoughtful(r.cargo, CONFIG));
  const best = rows.reduce((a, r) => (rate(r) > rate(a) ? r : a));
  const above95 = rows.filter((r) => rate(r) > 0.95).length;

  console.log('Summary (target in brackets)');
  console.log(`  blind random fill (any items, ${fullRandom.length} cargos):          ${pct(mean(fullRandom))}`);
  console.log(`  random cargo (random fill that names power+air+water+food, ${full.length}):  ${pct(mean(full))}   [20-30 %]`);
  console.log(`  thoughtful cargo (checklist, ${thoughtful.length} cargos):          ${pct(mean(thoughtful))}   [75-85 %]`);
  console.log(`  best single cargo:                                  ${pct(rate(best))}   [no cargo above 95 %]`);
  console.log(`  cargos above 95 %:                                  ${above95}   [0]`);
  const viable = rows.filter((r) => rate(r) >= 0.75);
  const share = (f: (c: Cargo) => boolean) => `${viable.filter((r) => f(r.cargo)).length}`;
  console.log(
    `  cargos with 75 %+ success:                          ${viable.length} (reactor ${share((c) => has(c, 'reactor') > 0)}, solar+battery ${share((c) => has(c, 'reactor') === 0 && has(c, 'solar') > 0)}, no power plant ${share((c) => has(c, 'reactor') + has(c, 'solar') === 0)}, no generator ${share((c) => has(c, 'o2gen') === 0)})`,
  );
  console.log(`  cargos that never succeed:                          ${rows.filter((r) => r.wins === 0).length} of ${rows.length}`);

  const ranked = rows.slice().sort((a, b) => b.wins - a.wins || b.starSum - a.starSum || cargoMass(a.cargo, CONFIG) - cargoMass(b.cargo, CONFIG));
  const top = ranked.slice(0, 10);
  console.log('\nTop 10 cargos');
  top.forEach((r, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)}. ${pct(rate(r)).padStart(7)}  mass ${String(cargoMass(r.cargo, CONFIG)).padStart(2)}  ${cargoLabel(r.cargo)}`,
    ),
  );
  console.log('\nHow often each item appears in the top 10 cargos');
  for (const id of ITEM_ORDER) {
    const inTop = top.filter((r) => (r.cargo[id] ?? 0) > 0).length;
    console.log(`  ${id.padEnd(11)} ${'#'.repeat(inTop).padEnd(10)} ${inTop}/10`);
  }
  const top1 = ranked.slice(0, Math.max(10, Math.floor(rows.length * 0.001)));
  console.log(`\nHow often each item appears in the best 0.1 % of cargos (${top1.length} cargos)`);
  for (const id of ITEM_ORDER) {
    const inTop = top1.filter((r) => (r.cargo[id] ?? 0) > 0).length;
    console.log(`  ${id.padEnd(11)} ${pct(inTop / top1.length).padStart(7)}`);
  }
}
