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
    return compactQuestions(container);
  }

  if (container && typeof container === 'object') {
    const record = container as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return compactQuestions(record.items);
    }
  }

  return [];
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => String(value || '').trim())) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => String(value || '').trim())) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function parseSuggestedQuestionsCsv(csvText: string): string[] {
  const rows = parseCsvRows(csvText);
  if (!rows.length) return [];

  const headers = rows[0].map(normalizeHeader);
  const questionColumn = headers.findIndex((header) =>
    ['question', 'questions', 'pregunta', 'preguntas'].includes(header)
  );
  const valueColumn = questionColumn >= 0 ? questionColumn : 0;
  const dataRows = questionColumn >= 0 ? rows.slice(1) : rows;

  return compactQuestions(dataRows.map((row) => row[valueColumn] || ''));
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
