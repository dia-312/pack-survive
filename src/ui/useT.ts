import { useCallback } from 'react';
import { dirOf, translate, type Lang, type Translate } from '../i18n';
import { useStore } from './store';

export function useT(): { t: Translate; lang: Lang; dir: 'ltr' | 'rtl' } {
  const lang = useStore((s) => s.lang);
  const t = useCallback<Translate>((key, vars) => translate(lang, key, vars), [lang]);
  return { t, lang, dir: dirOf(lang) };
}
