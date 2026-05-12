import { describe, expect, it } from 'vitest';

import {
  normalizeSuggestedQuestions,
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

  it('selects and refreshes from ordered recommendations without repeating visible prompts', () => {
    const pool = ['One', 'Two', 'Three', 'Four'];
    expect(selectInitialSuggestedQuestions(pool, 3)).toEqual(['One', 'Two', 'Three']);
    expect(replaceSuggestedQuestionAt(pool, ['One', 'Two', 'Three'], 1)).toEqual(['One', 'Four', 'Three']);
  });
});
