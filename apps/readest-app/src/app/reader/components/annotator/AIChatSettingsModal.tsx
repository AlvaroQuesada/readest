import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import Dialog from '@/components/Dialog';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AgentChatConfig,
  ContextScope,
  getAgentChatConfig,
  saveAgentChatConfig,
  DEFAULT_AGENT_CHAT_CONFIG,
} from '@/services/ai/agentChatService';
import { FiEye, FiEyeOff, FiRotateCcw } from 'react-icons/fi';

interface AIChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (config: AgentChatConfig) => void;
}

const OPENAI_MODELS = [
  { value: 'gpt-6-luna', label: 'GPT-6 Luna (Ultrarrápido y recomendado)' },
  { value: 'gpt-4o', label: 'GPT-4o (Omni)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'custom', label: 'Otro modelo personalizado...' },
];

const DEEPSEEK_MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek-V3 (deepseek-chat)' },
  { value: 'deepseek-reasoner', label: 'DeepSeek-R1 (deepseek-reasoner)' },
  { value: 'custom', label: 'Otro modelo personalizado...' },
];

export const AIChatSettingsModal: React.FC<AIChatSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const _ = useTranslation();
  const [provider, setProvider] = useState<'openai' | 'deepseek' | 'custom'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-6-luna');
  const [customModel, setCustomModel] = useState('');
  const [isCustomModelSelected, setIsCustomModelSelected] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [contextScope, setContextScope] = useState<ContextScope>('paragraph');
  const [initialPrompt, setInitialPrompt] = useState(DEFAULT_AGENT_CHAT_CONFIG.initialPrompt);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getAgentChatConfig();
      setProvider(cfg.provider);
      setApiKey(cfg.apiKey);
      setBaseUrl(cfg.baseUrl || '');
      setContextScope(cfg.contextScope || 'paragraph');
      setInitialPrompt(cfg.initialPrompt || DEFAULT_AGENT_CHAT_CONFIG.initialPrompt);

      const knownModels = cfg.provider === 'deepseek' ? DEEPSEEK_MODELS : OPENAI_MODELS;
      const match = knownModels.find((m) => m.value === cfg.model && m.value !== 'custom');
      if (match) {
        setModel(cfg.model);
        setIsCustomModelSelected(false);
      } else {
        setModel('custom');
        setCustomModel(cfg.model);
        setIsCustomModelSelected(true);
      }
    }
  }, [isOpen]);

  const handleProviderChange = (newProvider: 'openai' | 'deepseek' | 'custom') => {
    setProvider(newProvider);
    if (newProvider === 'deepseek') {
      setModel('deepseek-chat');
      setIsCustomModelSelected(false);
    } else if (newProvider === 'openai') {
      setModel('gpt-6-luna');
      setIsCustomModelSelected(false);
    } else {
      setModel('custom');
      setIsCustomModelSelected(true);
    }
  };

  const handleModelSelectChange = (val: string) => {
    setModel(val);
    if (val === 'custom') {
      setIsCustomModelSelected(true);
    } else {
      setIsCustomModelSelected(false);
    }
  };

  const handleSave = () => {
    const finalModel = isCustomModelSelected ? customModel.trim() || 'gpt-6-luna' : model;
    const newConfig: AgentChatConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: finalModel,
      baseUrl: baseUrl.trim(),
      contextScope,
      initialPrompt: initialPrompt.trim() || DEFAULT_AGENT_CHAT_CONFIG.initialPrompt,
    };
    saveAgentChatConfig(newConfig);
    onSaved?.(newConfig);
    onClose();
  };

  const handleResetPrompt = () => {
    setInitialPrompt(DEFAULT_AGENT_CHAT_CONFIG.initialPrompt);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={_('Configuración del Agente IA')}
      boxClassName='sm:w-[500px] sm:max-w-[95vw] sm:h-auto sm:max-h-[88vh]'
      contentClassName='px-4 sm:px-6'
    >
      <div className='flex flex-col gap-4 py-2 text-sm'>
        {/* Provider */}
        <div className='flex flex-col gap-1.5'>
          <label className='font-semibold text-base-content'>{_('Proveedor de IA')}</label>
          <div className='flex gap-2 w-full'>
            <button
              type='button'
              onClick={() => handleProviderChange('openai')}
              className={clsx(
                'btn btn-sm flex-1 text-xs',
                provider === 'openai' ? 'btn-primary' : 'btn-outline',
              )}
            >
              OpenAI
            </button>
            <button
              type='button'
              onClick={() => handleProviderChange('deepseek')}
              className={clsx(
                'btn btn-sm flex-1 text-xs',
                provider === 'deepseek' ? 'btn-primary' : 'btn-outline',
              )}
            >
              DeepSeek
            </button>
            <button
              type='button'
              onClick={() => handleProviderChange('custom')}
              className={clsx(
                'btn btn-sm flex-1 text-xs',
                provider === 'custom' ? 'btn-primary' : 'btn-outline',
              )}
            >
              {_('Custom')}
            </button>
          </div>
        </div>

        {/* API Key */}
        <div className='flex flex-col gap-1.5'>
          <label className='font-semibold text-base-content flex items-center justify-between'>
            <span>{_('API Key')}</span>
            <span className='text-xs opacity-60 font-normal'>
              {provider === 'openai' ? 'sk-...' : provider === 'deepseek' ? 'sk-...' : ''}
            </span>
          </label>
          <div className='relative flex items-center'>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={_('Pega aquí tu API key')}
              className='input input-bordered input-sm w-full pr-9 font-mono text-xs'
            />
            <button
              type='button'
              onClick={() => setShowKey(!showKey)}
              className='absolute right-2 text-base-content/60 hover:text-base-content'
              title={showKey ? _('Ocultar') : _('Mostrar')}
            >
              {showKey ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          <p className='text-[11px] text-base-content/60'>
            {_('Tu clave se guarda localmente en tu navegador y nunca se comparte.')}
          </p>
        </div>

        {/* Model */}
        <div className='flex flex-col gap-1.5'>
          <label className='font-semibold text-base-content'>{_('Modelo')}</label>
          {provider !== 'custom' ? (
            <select
              value={model}
              onChange={(e) => handleModelSelectChange(e.target.value)}
              className='select select-bordered select-sm w-full text-xs'
            >
              {(provider === 'deepseek' ? DEEPSEEK_MODELS : OPENAI_MODELS).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : null}

          {isCustomModelSelected && (
            <input
              type='text'
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder={_('Nombre del modelo (ej: gpt-6-luna, deepseek-chat)')}
              className='input input-bordered input-sm w-full font-mono text-xs mt-1'
            />
          )}
        </div>

        {/* Custom Base URL (if custom) */}
        {provider === 'custom' && (
          <div className='flex flex-col gap-1.5'>
            <label className='font-semibold text-base-content'>{_('Base URL (Endpoint)')}</label>
            <input
              type='text'
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder='https://api.openai.com/v1'
              className='input input-bordered input-sm w-full font-mono text-xs'
            />
          </div>
        )}

        {/* Context Scope */}
        <div className='flex flex-col gap-1.5'>
          <label className='font-semibold text-base-content flex items-center justify-between'>
            <span>{_('Alcance del Contexto')}</span>
            <span className='text-xs opacity-60 font-mono'>{'{{context}}'}</span>
          </label>
          <select
            value={contextScope}
            onChange={(e) => setContextScope(e.target.value as ContextScope)}
            className='select select-bordered select-sm w-full text-xs'
          >
            <option value='paragraph'>
              {_('Párrafo completo donde está el texto (Recomendado)')}
            </option>
            <option value='wide'>{_('Párrafo + entorno amplio')}</option>
            <option value='selection'>{_('Solo el texto seleccionado')}</option>
          </select>
          <p className='text-[11px] text-base-content/60'>
            {_(
              'Envía el párrafo que rodea a la palabra o frase para que la IA entienda el sentido exacto.',
            )}
          </p>
        </div>

        {/* Initial Prompt */}
        <div className='flex flex-col gap-1.5'>
          <div className='flex items-center justify-between'>
            <label className='font-semibold text-base-content'>{_('Prompt Inicial')}</label>
            <button
              type='button'
              onClick={handleResetPrompt}
              className='text-xs text-primary flex items-center gap-1 hover:underline'
            >
              <FiRotateCcw size={12} />
              {_('Restablecer')}
            </button>
          </div>
          <textarea
            rows={4}
            value={initialPrompt}
            onChange={(e) => setInitialPrompt(e.target.value)}
            className='textarea textarea-bordered textarea-sm w-full text-xs leading-relaxed font-mono'
            placeholder={_('Escribe la instrucción inicial...')}
          />
          <p className='text-[11px] text-base-content/60 leading-normal'>
            {_('Variables:')} <code className='badge badge-xs font-mono'>{'{{text}}'}</code>{' '}
            {_('(texto seleccionado)')},{' '}
            <code className='badge badge-xs font-mono'>{'{{context}}'}</code>{' '}
            {_('(párrafo de contexto)')},{' '}
            <code className='badge badge-xs font-mono'>{'{{bookTitle}}'}</code>{' '}
            {_('(título del libro)')}.
          </p>
        </div>

        {/* Actions */}
        <div className='flex justify-end gap-2 mt-2 pt-2 border-t border-base-content/10'>
          <button type='button' onClick={onClose} className='btn btn-ghost btn-sm'>
            {_('Cancelar')}
          </button>
          <button type='button' onClick={handleSave} className='btn btn-primary btn-sm'>
            {_('Guardar')}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default AIChatSettingsModal;
