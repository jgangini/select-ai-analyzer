export const STARTER_SUGGESTED_QUESTIONS = [
  '¿Cuál es el saldo actual por moneda y sucursal?',
  '¿Qué cuentas tienen mayor saldo bloqueado?',
  '¿Qué productos tienen mayor volumen de transacciones este mes?',
  '¿Cuál es la tendencia diaria de débitos vs créditos en marzo?',
  '¿Qué clientes tienen mayor volumen de transacciones este mes?',
  '¿Qué cuentas tienen más retiros ATM?',
  '¿Qué préstamos tienen mayor deuda pendiente?',
  '¿Qué contratos de depósito vencen en los próximos 30 días?',
  '¿Qué cuentas tienen transacciones ocultas en estados de cuenta?',
  '¿Qué usuarios autorizaron más movimientos contables?',
] as const;

export function compactQuestions(values: unknown[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => {
      const normalized = value.toLowerCase().replace(/\s+/g, ' ').replace(/^[¿?¡!\s.]+|[¿?¡!\s.]+$/g, '');
      if (!value || !normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function normalizeSuggestedQuestions(value: unknown): string[] {
  const container =
    value && typeof value === 'object' && 'suggested_questions' in value
      ? (value as { suggested_questions?: unknown }).suggested_questions
      : value;

  if (Array.isArray(container)) {
    const questions = compactQuestions(container);
    return questions.length ? questions : [...STARTER_SUGGESTED_QUESTIONS];
  }

  if (container && typeof container === 'object') {
    const record = container as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      const questions = compactQuestions(record.items);
      return questions.length ? questions : [...STARTER_SUGGESTED_QUESTIONS];
    }
  }

  return [...STARTER_SUGGESTED_QUESTIONS];
}

export function selectInitialSuggestedQuestions(questions: string[], count = 3): string[] {
  return compactQuestions(questions).slice(0, count);
}

export function replaceSuggestedQuestionAt(
  questions: string[],
  currentQuestions: string[],
  questionIndex: number
): string[] {
  if (questionIndex < 0 || questionIndex >= currentQuestions.length) return currentQuestions;

  const currentQuestion = currentQuestions[questionIndex] || '';
  const visibleQuestions = new Set(
    compactQuestions(currentQuestions.filter((_question, index) => index !== questionIndex))
  );
  const replacement = compactQuestions(questions).find(
    (question) => !visibleQuestions.has(question) && question !== currentQuestion
  );

  if (!replacement) return currentQuestions;

  return currentQuestions.map((question, index) => (index === questionIndex ? replacement : question));
}
