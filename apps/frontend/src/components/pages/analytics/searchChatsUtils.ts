type ConversationMessageForExport = {
  question: string;
  result: {
    answer?: string;
    sql?: string;
  };
};

type ConversationDetailForExport = {
  title?: string;
  created_at: string;
  updated_at: string;
  messages: ConversationMessageForExport[];
};

type ConversationSummaryForSort = {
  created_at?: string;
  updated_at?: string;
};

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getSafeFileName(value: string): string {
  return String(value || 'chat')
    .replace(/[^\w\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'chat';
}

export function buildConversationMarkdown(conversation: ConversationDetailForExport): string {
  const lines = [
    `# ${conversation.title || 'Analytics chat'}`,
    '',
    `Created: ${formatDateTime(conversation.created_at)}`,
    `Updated: ${formatDateTime(conversation.updated_at)}`,
    '',
  ];

  conversation.messages.forEach((message, index) => {
    lines.push(`## ${index + 1}. Question`, '', message.question, '', '## Answer', '', message.result.answer || '');
    if (message.result.sql) lines.push('', '```sql', message.result.sql, '```');
    lines.push('');
  });

  return lines.join('\n');
}

export function sortConversations<T extends ConversationSummaryForSort>(items: T[]): T[] {
  return items.slice().sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}
