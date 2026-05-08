export type AnalyticsChatResult = {
  run_id: string;
  conversation_id: string;
  answer: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  chart_spec: {
    type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
    title?: string;
    x?: string;
    y?: string;
    series?: string;
  };
  agent_trace: Array<{
    stage: string;
    status: string;
    rows?: number;
    profile_name?: string;
    objects?: Array<{ owner?: string; name?: string; columns?: string[] }>;
  }>;
};

type AnalyticsConversationForMessages = {
  messages: Array<{
    run_id: string;
    question: string;
    created_at?: string;
    result: AnalyticsChatResult;
  }>;
};

export type AnalyticsChatMessage =
  | { id: string; role: 'user'; content: string; timestamp: Date }
  | { id: string; role: 'assistant'; content: string; timestamp: Date; result: AnalyticsChatResult; question: string };

export function getAnalyticsErrorMessage(error: unknown): string {
  const maybeError =
    error && typeof error === 'object'
      ? (error as { response?: { data?: { detail?: string } }; message?: string })
      : {};
  return maybeError.response?.data?.detail || maybeError.message || 'The question could not be executed.';
}

export function getDefaultDashboardName(conversationTitle: string): string {
  const normalized = conversationTitle.replace(/^New analytics chat$/i, 'Analytics dashboard').trim();
  return normalized || 'Analytics dashboard';
}

export function getUserInitials(name: string): string {
  return String(name || 'User')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function buildDashboardDraftItem<TChartSpec extends object>(
  result: { run_id: string; sql: string; chart_spec: TChartSpec },
  question: string
) {
  const chartTitle = (result.chart_spec as { title?: string }).title;
  return {
    draft_id: result.run_id,
    run_id: result.run_id,
    title: chartTitle || question.slice(0, 120) || 'Analytics visualization',
    question,
    sql: result.sql,
    chart_spec: result.chart_spec,
  };
}

export function buildConversationMessages(conversation: AnalyticsConversationForMessages): AnalyticsChatMessage[] {
  return conversation.messages.flatMap((message) => {
    const timestamp = message.created_at ? new Date(message.created_at) : new Date();
    return [
      {
        id: `${message.run_id}-user`,
        role: 'user' as const,
        content: message.question,
        timestamp,
      },
      {
        id: `${message.run_id}-assistant`,
        role: 'assistant' as const,
        content: message.result.answer,
        timestamp,
        result: message.result,
        question: message.question,
      },
    ];
  });
}

function findLatestMessage<Role extends AnalyticsChatMessage['role']>(
  messages: AnalyticsChatMessage[],
  role: Role
): Extract<AnalyticsChatMessage, { role: Role }> | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === role) return message as Extract<AnalyticsChatMessage, { role: Role }>;
  }
  return undefined;
}

export function findLatestAssistantMessage(messages: AnalyticsChatMessage[]) {
  return findLatestMessage(messages, 'assistant');
}

export function findLatestUserQuestion(messages: AnalyticsChatMessage[]): string {
  return findLatestMessage(messages, 'user')?.content || '';
}
