'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { Settings } from '@/hooks/useSettings';
import { joyCaptionLengths, joyCaptionTypes } from '@/helpers/captionOptions';
import { NumberInput, SelectInput, TextAreaInput, TextInput } from '@/components/formInputs';
import { apiClient } from '@/utils/api';

export const LOCAL_JOYCAPTION_MODEL = '/root/alvan-custom/joy-captioner';
export const HF_JOYCAPTION_MODEL = 'fancyfeast/llama-joycaption-beta-one-hf-llava';

export const normalizeCaptionBackend = (backend?: string) => {
  if (backend === 'joycaption') return 'joycaption_local';
  return backend || 'joycaption_local';
};

export const isJoyCaptionBackend = (backend?: string) => normalizeCaptionBackend(backend).startsWith('joycaption');

export const applyCaptionDefaults = (settings: Settings): Settings => {
  const backend = normalizeCaptionBackend(settings.CAPTION_ENDPOINT_TYPE);
  let model = settings.CAPTION_MODEL;
  if (!model && backend === 'joycaption_local') model = LOCAL_JOYCAPTION_MODEL;
  if (!model && backend === 'joycaption_hf') model = HF_JOYCAPTION_MODEL;
  return {
    ...settings,
    CAPTION_ENDPOINT_TYPE: backend,
    CAPTION_MODEL: model,
    CAPTION_MAX_TOKENS: settings.CAPTION_MAX_TOKENS || '512',
    CAPTION_JOY_CAPTION_TYPE: settings.CAPTION_JOY_CAPTION_TYPE || 'Descriptive',
    CAPTION_JOY_CAPTION_LENGTH: settings.CAPTION_JOY_CAPTION_LENGTH || 'any',
    CAPTION_JOY_LOW_VRAM: settings.CAPTION_JOY_LOW_VRAM || 'false',
    CAPTION_KEEP_LOADED: settings.CAPTION_KEEP_LOADED || 'false',
    CAPTION_OPT_REFER_BY_NAME: settings.CAPTION_OPT_REFER_BY_NAME || 'false',
    CAPTION_OPT_EXCLUDE_UNCHANGEABLE: settings.CAPTION_OPT_EXCLUDE_UNCHANGEABLE || 'false',
    CAPTION_OPT_INCLUDE_LIGHTING: settings.CAPTION_OPT_INCLUDE_LIGHTING || 'false',
    CAPTION_OPT_INCLUDE_CAMERA_ANGLE: settings.CAPTION_OPT_INCLUDE_CAMERA_ANGLE || 'false',
    CAPTION_OPT_INCLUDE_WATERMARK: settings.CAPTION_OPT_INCLUDE_WATERMARK || 'false',
    CAPTION_OPT_INCLUDE_JPEG: settings.CAPTION_OPT_INCLUDE_JPEG || 'false',
    CAPTION_OPT_INCLUDE_CAMERA_DETAILS: settings.CAPTION_OPT_INCLUDE_CAMERA_DETAILS || 'false',
    CAPTION_OPT_NO_SEXUAL: settings.CAPTION_OPT_NO_SEXUAL || 'false',
    CAPTION_OPT_NO_REAL_PEOPLE: settings.CAPTION_OPT_NO_REAL_PEOPLE || 'false',
    CAPTION_OPT_ARTISTIC_PERSPECTIVE: settings.CAPTION_OPT_ARTISTIC_PERSPECTIVE || 'false',
  };
};

const captionOptionToggles: Array<{ key: keyof Settings; label: string }> = [
  { key: 'CAPTION_OPT_REFER_BY_NAME', label: 'Refer to subject by trigger/name' },
  { key: 'CAPTION_OPT_INCLUDE_LIGHTING', label: 'Include lighting details' },
  { key: 'CAPTION_OPT_INCLUDE_CAMERA_ANGLE', label: 'Include camera angle' },
  { key: 'CAPTION_OPT_INCLUDE_CAMERA_DETAILS', label: 'Include camera / lens details' },
  { key: 'CAPTION_OPT_INCLUDE_WATERMARK', label: 'Note watermarks' },
  { key: 'CAPTION_OPT_INCLUDE_JPEG', label: 'Note JPEG artifacts' },
  { key: 'CAPTION_OPT_EXCLUDE_UNCHANGEABLE', label: 'Exclude fixed attributes' },
  { key: 'CAPTION_OPT_ARTISTIC_PERSPECTIVE', label: 'Maintain artistic perspective' },
  { key: 'CAPTION_OPT_NO_SEXUAL', label: 'Keep it PG' },
  { key: 'CAPTION_OPT_NO_REAL_PEOPLE', label: 'No identifiable real people' },
];

interface AICaptionSettingsFieldsProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export const AICaptionSettingsFields: React.FC<AICaptionSettingsFieldsProps> = ({ settings, setSettings }) => {
  const backend = normalizeCaptionBackend(settings.CAPTION_ENDPOINT_TYPE);
  const isJoyCaption = isJoyCaptionBackend(backend);
  const [workerStatus, setWorkerStatus] = useState<any>(null);
  const [workerAction, setWorkerAction] = useState<'idle' | 'loading' | 'unloading'>('idle');

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateBackend = (value: string) => {
    setSettings(prev => {
      const next = applyCaptionDefaults({ ...prev, CAPTION_ENDPOINT_TYPE: value });
      if (value === 'joycaption_local' && (!prev.CAPTION_MODEL || prev.CAPTION_MODEL === HF_JOYCAPTION_MODEL)) {
        next.CAPTION_MODEL = LOCAL_JOYCAPTION_MODEL;
      }
      if (value === 'joycaption_hf' && (!prev.CAPTION_MODEL || prev.CAPTION_MODEL === LOCAL_JOYCAPTION_MODEL)) {
        next.CAPTION_MODEL = HF_JOYCAPTION_MODEL;
      }
      return next;
    });
  };

  const refreshWorkerStatus = async () => {
    if (!isJoyCaption) return;
    try {
      const res = await apiClient.get('/api/captioner/status');
      setWorkerStatus(res.data);
    } catch {
      setWorkerStatus(null);
    }
  };

  useEffect(() => {
    refreshWorkerStatus();
  }, [isJoyCaption]);

  const loadWorker = async () => {
    setWorkerAction('loading');
    try {
      const nextSettings = applyCaptionDefaults({ ...settings, CAPTION_KEEP_LOADED: 'true' });
      setSettings(nextSettings);
      await apiClient.post('/api/settings', nextSettings);
      await apiClient.post('/api/captioner/load');
      await refreshWorkerStatus();
    } finally {
      setWorkerAction('idle');
    }
  };

  const unloadWorker = async () => {
    setWorkerAction('unloading');
    try {
      await apiClient.post('/api/captioner/unload');
      await refreshWorkerStatus();
    } finally {
      setWorkerAction('idle');
    }
  };

  return (
    <div className="space-y-4">
      <SelectInput
        label="Caption Backend"
        value={backend}
        onChange={updateBackend}
        options={[
          { value: 'joycaption_local', label: 'Local JoyCaption model path' },
          { value: 'joycaption_hf', label: 'JoyCaption from Hugging Face' },
          { value: 'openai', label: 'OpenAI-compatible endpoint' },
        ]}
      />

      {backend === 'openai' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextInput
            label="Base URL"
            value={settings.CAPTION_BASE_URL}
            onChange={value => updateSetting('CAPTION_BASE_URL', value)}
            placeholder="https://api.openai.com/v1 or http://127.0.0.1:11434/v1"
            required
          />
          <TextInput
            label="API Key"
            type="password"
            value={settings.CAPTION_API_KEY}
            onChange={value => updateSetting('CAPTION_API_KEY', value)}
            placeholder="Leave blank if your endpoint does not need one"
          />
        </div>
      )}

      <TextInput
        label={isJoyCaption ? 'JoyCaption Model Path or HF Repo' : 'Vision Model ID'}
        value={settings.CAPTION_MODEL}
        onChange={value => updateSetting('CAPTION_MODEL', value)}
        placeholder={backend === 'joycaption_hf' ? HF_JOYCAPTION_MODEL : backend === 'joycaption_local' ? LOCAL_JOYCAPTION_MODEL : 'gpt-4o, llava, qwen2.5-vl:7b'}
        required
      />

      {isJoyCaption && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectInput
              label="JoyCaption Style"
              value={settings.CAPTION_JOY_CAPTION_TYPE || 'Descriptive'}
              onChange={value => updateSetting('CAPTION_JOY_CAPTION_TYPE', value)}
              options={joyCaptionTypes}
            />
            <SelectInput
              label="JoyCaption Length"
              value={settings.CAPTION_JOY_CAPTION_LENGTH || 'any'}
              onChange={value => updateSetting('CAPTION_JOY_CAPTION_LENGTH', value)}
              options={joyCaptionLengths}
            />
          </div>
          <label className="flex items-center gap-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={settings.CAPTION_JOY_LOW_VRAM === 'true'}
              onChange={e => updateSetting('CAPTION_JOY_LOW_VRAM', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-gray-600 bg-gray-900"
            />
            Low VRAM mode
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={settings.CAPTION_KEEP_LOADED === 'true'}
              onChange={e => updateSetting('CAPTION_KEEP_LOADED', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-gray-600 bg-gray-900"
            />
            Keep JoyCaption loaded between captions
          </label>
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-700 bg-gray-900/60 p-3 text-sm text-gray-200">
            <span className="mr-auto">
              JoyCaption worker: {workerStatus?.status || 'unloaded'}
              {workerStatus?.pid ? ` (PID ${workerStatus.pid})` : ''}
            </span>
            <button
              type="button"
              onClick={loadWorker}
              disabled={workerAction !== 'idle'}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {workerAction === 'loading' ? 'Loading...' : 'Load & Keep Loaded'}
            </button>
            <button
              type="button"
              onClick={unloadWorker}
              disabled={workerAction !== 'idle'}
              className="rounded-md bg-gray-700 px-3 py-1.5 text-white hover:bg-gray-600 disabled:opacity-50"
            >
              {workerAction === 'unloading' ? 'Unloading...' : 'Unload Before Training'}
            </button>
            {workerStatus?.lastError && <div className="basis-full text-xs text-red-400">{workerStatus.lastError}</div>}
          </div>
        </>
      )}

      <TextInput
        label="Trigger Word / Subject Name"
        value={settings.CAPTION_TRIGGER_WORD}
        onChange={value => updateSetting('CAPTION_TRIGGER_WORD', value)}
        placeholder="rosa"
      />

      <TextAreaInput
        label="Caption Instructions"
        value={settings.CAPTION_USER_PROMPT}
        onChange={value => updateSetting('CAPTION_USER_PROMPT', value)}
        rows={5}
        placeholder="Extra rules appended to the caption prompt, e.g. mention pose, clothing, background, and use the trigger word when appropriate."
      />

      <div>
        <div className="text-xs mb-2 mt-2 text-gray-300">What to include / exclude</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {captionOptionToggles.map(option => (
            <label key={option.key} className="flex items-center gap-3 text-sm text-gray-200">
              <input
                type="checkbox"
                checked={settings[option.key] === 'true'}
                onChange={e => updateSetting(option.key, e.target.checked ? 'true' : 'false')}
                className="h-4 w-4 rounded border-gray-600 bg-gray-900"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {backend === 'openai' && (
        <TextAreaInput
          label="System Prompt"
          value={settings.CAPTION_SYSTEM_PROMPT}
          onChange={value => updateSetting('CAPTION_SYSTEM_PROMPT', value)}
          rows={3}
          placeholder="Optional system message for your captioning endpoint"
        />
      )}

      <NumberInput
        label="Max New Tokens"
        value={parseInt(settings.CAPTION_MAX_TOKENS || '512') || 512}
        onChange={value => updateSetting('CAPTION_MAX_TOKENS', `${value || 512}`)}
        min={1}
      />
    </div>
  );
};
