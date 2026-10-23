import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import Dialog from '@/components/Dialog';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AgentChatConfig,
  getAgentChatConfig,
  streamAgentChat,
  DEFAULT_AGENT_CHAT_CONFIG,
} from '@/services/ai/agentChatService';
import AIChatSettingsModal from './AIChatSettingsModal';
import { FiSettings, FiSend, FiStopCircle, FiRefreshCw } from 'react-icons/fi';
import { BsChatDots, BsQuote } from 'react-icons/bs';
import { AssistantTextPart } from '@/services/reedy/ui/parts/TextPart';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  contextText?: string;
  bookTitle?: string;
  bookAuthor?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  selectedText,
  contextText,
  bookTitle,
  bookAuthor,
}) => {
  const _ = useTranslation();
  const [config, setConfig] = useState<AgentChatConfig>(DEFAULT_AGENT_CHAT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedTextRef = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Load config on open
  useEffect(() => {
    if (isOpen) {
      const cfg = getAgentChatConfig();
      setConfig(cfg);
      if (!cfg.apiKey) {
        setShowSettings(true);
      }
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsGenerating(false);
    }
  }, [isOpen]);

  const runChat = useCallback(
    async (
      allMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
      currentCfg: AgentChatConfig,
    ) => {
      setError(null);
      setIsGenerating(true);

      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

      const abortCtrl = new AbortController();
      abortControllerRef.current = abortCtrl;

      try {
        await streamAgentChat({
          config: currentCfg,
          messages: allMessages,
          signal: abortCtrl.signal,
          onDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m)),
            );
          },
        });
      } catch (err: unknown) {
        if (abortCtrl.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [],
  );

  // Trigger initial conversation when opened with selectedText
  useEffect(() => {
    if (!isOpen || !selectedText || !config.apiKey) return;
    if (lastProcessedTextRef.current === selectedText) return;

    lastProcessedTextRef.current = selectedText;

    const initialTemplate = config.initialPrompt || DEFAULT_AGENT_CHAT_CONFIG.initialPrompt;
    let initialPrompt = initialTemplate.replace(/\{\{text\}\}/g, selectedText);
    const resolvedContext = contextText || selectedText;
    initialPrompt = initialPrompt.replace(/\{\{context\}\}/g, resolvedContext);
    if (bookTitle) {
      initialPrompt = initialPrompt.replace(/\{\{bookTitle\}\}/g, bookTitle);
    }
    if (bookAuthor) {
      initialPrompt = initialPrompt.replace(/\{\{bookAuthor\}\}/g, bookAuthor);
    }

    const firstMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: initialPrompt,
    };

    setMessages([firstMsg]);
    runChat([{ role: 'user', content: initialPrompt }], config);
  }, [isOpen, selectedText, contextText, config, bookTitle, bookAuthor, runChat]);

  const handleSendMessage = () => {
    if (!input.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    runChat(
      newMessages.map((m) => ({ role: m.role, content: m.content })),
      config,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
  };

  const handleRetry = () => {
    if (messages.length === 0) return;
    const clean = messages.filter((m) => m.content !== '');
    setMessages(clean);
    runChat(
      clean.map((m) => ({ role: m.role, content: m.content })),
      config,
    );
  };

  const handleSettingsSaved = (newConfig: AgentChatConfig) => {
    setConfig(newConfig);
    // If we have selected text but haven't run the initial chat, run it now
    if (messages.length === 0 && selectedText && newConfig.apiKey) {
      const initialTemplate = newConfig.initialPrompt || DEFAULT_AGENT_CHAT_CONFIG.initialPrompt;
      let initialPrompt = initialTemplate.replace(/\{\{text\}\}/g, selectedText);
      const resolvedContext = contextText || selectedText;
      initialPrompt = initialPrompt.replace(/\{\{context\}\}/g, resolvedContext);
      if (bookTitle) initialPrompt = initialPrompt.replace(/\{\{bookTitle\}\}/g, bookTitle);
      if (bookAuthor) initialPrompt = initialPrompt.replace(/\{\{bookAuthor\}\}/g, bookAuthor);

      const firstMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: initialPrompt,
      };
      setMessages([firstMsg]);
      runChat([{ role: 'user', content: initialPrompt }], newConfig);
    }
  };

  const customHeader = (
    <div className='flex items-center justify-between w-full pr-8'>
      <div className='flex items-center gap-2'>
        <div className='p-1.5 rounded-lg bg-primary/10 text-primary'>
          <BsChatDots size={18} />
        </div>
        <div className='flex flex-col'>
          <div className='flex items-center gap-2'>
            <span className='font-bold text-sm text-base-content'>{_('Asistente IA')}</span>
            <span className='badge badge-xs badge-neutral font-mono'>{config.model}</span>
          </div>
          <span className='text-[10px] text-base-content/60 capitalize'>{config.provider}</span>
        </div>
      </div>
      <button
        type='button'
        onClick={() => setShowSettings(true)}
        className='btn btn-ghost btn-xs btn-circle text-base-content/70 hover:text-base-content'
        title={_('Configuración')}
      >
        <FiSettings size={15} />
      </button>
    </div>
  );

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        header={customHeader}
        boxClassName='sm:w-[580px] sm:max-w-[92vw] sm:h-[80vh] flex flex-col'
        contentClassName='p-0 overflow-hidden flex flex-col grow'
      >
        <div className='flex flex-col h-full overflow-hidden'>
          {/* Selected Text & Context Preview */}
          {(selectedText || contextText) && (
            <div className='mx-3 mt-3 p-3 rounded-xl bg-base-200/80 border border-base-content/10 flex flex-col gap-1.5 shrink-0'>
              <div className='flex items-start gap-2'>
                <BsQuote className='text-primary shrink-0 mt-0.5' size={18} />
                <div className='flex flex-col min-w-0'>
                  <span className='text-[10px] font-bold text-primary uppercase tracking-wider'>
                    {_('Texto Seleccionado')}
                  </span>
                  <p className='text-xs font-semibold text-base-content line-clamp-2 italic'>
                    "{selectedText}"
                  </p>
                </div>
              </div>
              {contextText && contextText !== selectedText && (
                <div className='ml-6 text-[11px] text-base-content/70 border-l-2 border-primary/30 pl-2 mt-0.5 line-clamp-3'>
                  <span className='font-medium text-base-content/50 mr-1'>{_('Contexto:')}</span>
                  <span>{contextText}</span>
                </div>
              )}
            </div>
          )}

          {/* Messages Area */}
          <div className='flex-1 overflow-y-auto p-4 space-y-4'>
            {messages.length === 0 && !config.apiKey && (
              <div className='flex flex-col items-center justify-center h-full text-center p-6 gap-3'>
                <div className='w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary'>
                  <BsChatDots size={24} />
                </div>
                <h4 className='font-bold text-base text-base-content'>
                  {_('Configura tu API Key')}
                </h4>
                <p className='text-xs text-base-content/60 max-w-xs'>
                  {_(
                    'Para consultar a GPT-6 Luna o DeepSeek sobre este texto, configura tu clave en ajustes.',
                  )}
                </p>
                <button
                  type='button'
                  onClick={() => setShowSettings(true)}
                  className='btn btn-primary btn-sm mt-2'
                >
                  <FiSettings size={14} className='mr-1' />
                  {_('Abrir Ajustes')}
                </button>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={clsx('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}
              >
                <div
                  className={clsx(
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'bg-primary text-primary-content rounded-br-none'
                      : 'bg-base-200 text-base-content rounded-bl-none shadow-sm border border-base-content/5',
                  )}
                >
                  {m.role === 'user' ? (
                    <div className='whitespace-pre-wrap break-words'>{m.content}</div>
                  ) : (
                    <AssistantTextPart text={m.content || '...'} />
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className='flex items-center gap-1.5 text-xs text-base-content/50 ml-2'>
                <span className='loading loading-dots loading-xs text-primary'></span>
                <span>
                  {_('Generando respuesta con')} {config.model}...
                </span>
              </div>
            )}

            {error && (
              <div className='alert alert-error text-xs p-2.5 rounded-xl flex items-center justify-between'>
                <span>{error}</span>
                <button
                  type='button'
                  onClick={handleRetry}
                  className='btn btn-xs btn-outline btn-ghost'
                >
                  <FiRefreshCw size={12} className='mr-1' />
                  {_('Reintentar')}
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className='p-3 border-t border-base-content/10 bg-base-100 shrink-0'>
            <div className='relative flex items-end gap-2'>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={_('Escribe tu pregunta o comentario (Enter para enviar)...')}
                rows={2}
                disabled={isGenerating || !config.apiKey}
                className='textarea textarea-bordered textarea-sm w-full text-xs leading-normal resize-none pr-10'
              />
              {isGenerating ? (
                <button
                  type='button'
                  onClick={handleStop}
                  className='btn btn-sm btn-error btn-circle absolute right-2 bottom-2'
                  title={_('Detener')}
                >
                  <FiStopCircle size={16} />
                </button>
              ) : (
                <button
                  type='button'
                  onClick={handleSendMessage}
                  disabled={!input.trim() || !config.apiKey}
                  className='btn btn-sm btn-primary btn-circle absolute right-2 bottom-2'
                  title={_('Enviar')}
                >
                  <FiSend size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </Dialog>

      <AIChatSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={handleSettingsSaved}
      />
    </>
  );
};

export default AIChatModal;
