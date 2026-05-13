import { describe, expect, it } from 'vitest';

import {
  normalizeSuggestedQuestions,
  parseSuggestedQuestionsCsv,
  replaceSuggestedQuestionAt,
  selectInitialSuggestedQuestions,
} from './suggestedQuestions';

describe('suggestedQuestions', () => {
  it('normalizes dynamic items and removes blank duplicate questions', () => {
    expect(
      normalizeSuggestedQuestions({
        items: [' Balance by branch ', '', 'balance by branch?', 'Credit trend'],
      })
    ).toEqual(['Balance by branch', 'Credit trend']);
  });

  it('returns an empty list when no questions are configured', () => {
    expect(normalizeSuggestedQuestions(null)).toEqual([]);
    expect(normalizeSuggestedQuestions({ items: [] })).toEqual([]);
  });

  it('parses question CSV files with headers, quotes and duplicate rows', () => {
    expect(
      parseSuggestedQuestionsCsv(
        'question,owner\n"¿Qué clientes crecieron más este mes?",ops\n"Question with ""quotes""",ops\n"¿Qué clientes crecieron más este mes?",ops\n'
      )
    ).toEqual(['¿Qué clientes crecieron más este mes?', 'Question with "quotes"']);
  });

  it('selects and refreshes from ordered recommendations without repeating visible prompts', () => {
    const pool = ['One', 'Two', 'Three', 'Four'];
    expect(selectInitialSuggestedQuestions(pool, 3)).toEqual(['One', 'Two', 'Three']);
    expect(replaceSuggestedQuestionAt(pool, ['One', 'Two', 'Three'], 1)).toEqual(['One', 'Four', 'Three']);
  });
});
