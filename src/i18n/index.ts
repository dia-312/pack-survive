import en from './en.json';
import ar from './ar.json';
import facts from '../data/facts.json';

export type Lang = 'en' | 'ar';
const dict: Record<Lang, Record<string, string>> = { en, ar };

export const dirOf = (lang: Lang): 'ltr' | 'rtl' => (lang === 'ar' ? 'rtl' : 'ltr');

/** All user-visible text goes through here. {name} placeholders are filled from vars. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface FactRecord {
  kid: Record<Lang, string>;
  scientist: Record<Lang, string>;
  source: { title: string; url: string; secondary?: boolean };
}
interface StoryRecord {
  title: Record<Lang, string>;
  text: Record<Lang, string>;
  source: { title: string; url: string; secondary?: boolean };
}

export function getFact(id: string): FactRecord | undefined {
  return (facts.facts as Record<string, FactRecord>)[id];
}
export function getStory(id: string): StoryRecord | undefined {
  return (facts.stories as Record<string, StoryRecord>)[id];
}
