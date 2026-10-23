export type ContextScope = 'paragraph' | 'selection' | 'wide';

export interface AgentChatConfig {
  provider: 'openai' | 'deepseek' | 'custom';
  apiKey: string;
  model: string;
  baseUrl?: string;
  contextScope: ContextScope;
  initialPrompt: string;
}

export const DEFAULT_AGENT_CHAT_CONFIG: AgentChatConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-6-luna',
  baseUrl: '',
  contextScope: 'paragraph',
  initialPrompt:
    'Explica detalladamente qué significa en este contexto la frase o término "{{text}}":\n\nContexto del libro:\n"{{context}}"',
};

const STORAGE_KEY = 'readest_agent_chat_config';

export function getAgentChatConfig(): AgentChatConfig {
  if (typeof window === 'undefined') return DEFAULT_AGENT_CHAT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT_CHAT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_AGENT_CHAT_CONFIG,
      ...parsed,
    };
  } catch {
    return DEFAULT_AGENT_CHAT_CONFIG;
  }
}

export function saveAgentChatConfig(config: AgentChatConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save AgentChatConfig', e);
  }
}

export function getSelectionContext(
  range?: Range | null,
  scope: ContextScope = 'paragraph',
): string {
  if (!range) return '';
  if (scope === 'selection') return range.toString().trim();

  try {
    let node: Node | null = range.commonAncestorContainer;
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.parentNode;
    }
    if (!node) return range.toString().trim();

    const BLOCK_TAGS = new Set([
      'P',
      'DIV',
      'SECTION',
      'ARTICLE',
      'BLOCKQUOTE',
      'LI',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
    ]);

    let block = node as HTMLElement | null;
    while (
      block &&
      block.tagName &&
      !BLOCK_TAGS.has(block.tagName.toUpperCase()) &&
      block.parentElement &&
      block.parentElement.tagName !== 'BODY'
    ) {
      block = block.parentElement;
    }

    if (scope === 'wide' && block?.parentElement && block.parentElement.tagName !== 'BODY') {
      block = block.parentElement;
    }

    const text = block?.textContent?.trim() || node.textContent?.trim() || '';
    return text.replace(/\s+/g, ' ');
  } catch (e) {
    console.warn('Failed to extract selection context', e);
    return range.toString().trim();
  }
}

export async function streamAgentChat({
  config,
  messages,
  onDelta,
  signal,
}: {
  config: AgentChatConfig;
  messages: Array<{ role: string; content: string }>;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const response = await fetch('/api/ai/agent-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    let errorMsg = `Error ${response.status}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No readable stream available in response.');
  }

  const decoder = new TextDecoder('utf-8');
  let accumulatedText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') continue;

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulatedText += delta;
            onDelta(delta);
          }
        } catch {
          // Ignore incomplete/unparseable chunks
        }
      }
    }
  }

  return accumulatedText;
}
