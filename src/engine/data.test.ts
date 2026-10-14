import { describe, expect, it } from 'vitest';
import factsJson from '../data/facts.json';
import { CONFIG } from './config';
import { TURNING_LINKS } from './score';

describe('data files', () => {
  const facts = factsJson.facts as Record<string, any>;
  const stories = factsJson.stories as Record<string, any>;

  it('every fact has kid + scientist text in both languages and a real https source', () => {
    for (const [id, f] of Object.entries(facts)) {
      for (const lang of ['en', 'ar']) {
        expect(f.kid[lang], `${id}.kid.${lang}`).toBeTruthy();
        expect(f.scientist[lang], `${id}.scientist.${lang}`).toBeTruthy();
      }
      expect(f.source.url, id).toMatch(/^https:\/\//);
    }
  });
  it('every situation points at a fact that exists', () => {
    for (const ev of Object.values(CONFIG.events)) expect(facts[ev.fact], ev.id).toBeTruthy();
  });
  it('every story has a source and both languages; turning points link to real stories', () => {
    for (const [id, s] of Object.entries(stories)) {
      expect(s.text.en && s.text.ar && s.title.en && s.title.ar, id).toBeTruthy();
      expect(s.source.url, id).toMatch(/^https:\/\//);
    }
    for (const link of Object.values(TURNING_LINKS)) {
      expect(stories[link.story] || facts[link.story], link.story).toBeTruthy();
    }
  });
  it('no fact contains the word TODO without being marked', () => {
    expect(JSON.stringify(factsJson).includes('TODO')).toBe(false);
  });
  it('items.json matches the brief', () => {
    const I = CONFIG.items;
    expect([I.solar.mass, I.battery.mass, I.reactor.mass, I.o2gen.mass, I.o2tank.mass]).toEqual([2, 2, 6, 2, 1]);
    expect([I.recycler.mass, I.watertank.mass, I.food.mass, I.greenhouse.mass]).toEqual([2, 1, 1, 3]);
    expect([I.shield.mass, I.excavator.mass, I.shelter.mass, I.spare.mass]).toEqual([4, 2, 2, 1]);
    expect(I.solar.power).toBe(6);
    expect(I.battery.capacity).toBe(10);
    expect(I.reactor.power).toBe(8);
    expect(I.o2gen.oxygen).toBe(4);
    expect(I.recycler.recovery).toBe(0.98);
    expect(CONFIG.params.massBudget).toBe(20);
  });
});
