export const DEFAULT_SUGGESTED_QUESTIONS = [
  'What is the current balance by currency and branch?',
  'Which accounts have the highest blocked balance?',
  'Which products have the highest movement volume this month?',
  'What is the daily debit and credit trend in March?',
  'Which customers increased transaction volume by more than 50% this month?',
  'Which accounts have the most ATM withdrawals?',
  'Which loans have the highest pending debt?',
  'Which deposit contracts mature in the next 30 days?',
  'Which accounts have hidden movements on statements?',
  'Which users authorized the most accounting movements?',
] as const;

export const SUGGESTED_QUESTION_KEYS = DEFAULT_SUGGESTED_QUESTIONS.map(
  (_question, index) => `question_${index + 1}`
);

function compactQuestions(values: unknown[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export function normalizeSuggestedQuestionRecord(value: unknown): Record<string, string> {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return SUGGESTED_QUESTION_KEYS.reduce<Record<string, string>>((acc, key, index) => {
    const configured = String(source[key] || '').trim();
    acc[key] = configured || DEFAULT_SUGGESTED_QUESTIONS[index];
    return acc;
  }, {});
}

export function resolveSuggestedQuestions(payload: unknown): string[] {
  const container = payload && typeof payload === 'object' ? (payload as { suggested_questions?: unknown }).suggested_questions : null;
  if (Array.isArray(container)) {
    const questions = compactQuestions(container);
    return questions.length >= 3 ? questions : [...DEFAULT_SUGGESTED_QUESTIONS];
  }
  if (container && typeof container === 'object') {
    const record = container as Record<string, unknown>;
    const itemValues = Array.isArray(record.items) ? record.items : SUGGESTED_QUESTION_KEYS.map((key) => record[key]);
    const questions = compactQuestions(itemValues);
    return questions.length >= 3 ? questions : [...DEFAULT_SUGGESTED_QUESTIONS];
  }
  return [...DEFAULT_SUGGESTED_QUESTIONS];
}

export function selectRandomSuggestedQuestions(
  questions: string[],
  count = 3,
  random: () => number = Math.random
): string[] {
  const pool = compactQuestions(questions);
  if (pool.length <= count) return pool;

  const selected: string[] = [];
  while (selected.length < count && pool.length > 0) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

export function replaceSuggestedQuestionAt(
  questions: string[],
  currentQuestions: string[],
  questionIndex: number,
  random: () => number = Math.random
): string[] {
  if (questionIndex < 0 || questionIndex >= currentQuestions.length) return currentQuestions;

  const normalizedCurrent = compactQuestions(currentQuestions);
  const currentQuestion = normalizedCurrent[questionIndex] || '';
  const visibleQuestions = new Set(normalizedCurrent.filter((_question, index) => index !== questionIndex));
  const pool = compactQuestions(questions).filter((question) => !visibleQuestions.has(question) && question !== currentQuestion);

  if (!pool.length) return currentQuestions;

  const replacementIndex = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return currentQuestions.map((question, index) => (index === questionIndex ? pool[replacementIndex] : question));
}
