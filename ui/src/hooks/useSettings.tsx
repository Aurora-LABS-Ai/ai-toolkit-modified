'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';

export interface Settings {
  HF_TOKEN: string;
  TRAINING_FOLDER: string;
  DATASETS_FOLDER: string;
  CAPTION_BASE_URL: string;
  CAPTION_API_KEY: string;
  CAPTION_MODEL: string;
  CAPTION_SYSTEM_PROMPT: string;
  CAPTION_USER_PROMPT: string;
  CAPTION_TRIGGER_WORD: string;
  CAPTION_MAX_TOKENS: string;
  CAPTION_ENDPOINT_TYPE: string;
  CAPTION_JOY_CAPTION_TYPE: string;
  CAPTION_JOY_CAPTION_LENGTH: string;
  CAPTION_JOY_LOW_VRAM: string;
  CAPTION_OPT_REFER_BY_NAME: string;
  CAPTION_OPT_EXCLUDE_UNCHANGEABLE: string;
  CAPTION_OPT_INCLUDE_LIGHTING: string;
  CAPTION_OPT_INCLUDE_CAMERA_ANGLE: string;
  CAPTION_OPT_INCLUDE_WATERMARK: string;
  CAPTION_OPT_INCLUDE_JPEG: string;
  CAPTION_OPT_INCLUDE_CAMERA_DETAILS: string;
  CAPTION_OPT_NO_SEXUAL: string;
  CAPTION_OPT_NO_REAL_PEOPLE: string;
  CAPTION_OPT_ARTISTIC_PERSPECTIVE: string;
}

const defaultSettings: Settings = {
  HF_TOKEN: '',
  TRAINING_FOLDER: '',
  DATASETS_FOLDER: '',
  CAPTION_BASE_URL: '',
  CAPTION_API_KEY: '',
  CAPTION_MODEL: '/root/alvan-custom/joy-captioner',
  CAPTION_SYSTEM_PROMPT: '',
  CAPTION_USER_PROMPT: '',
  CAPTION_TRIGGER_WORD: '',
  CAPTION_MAX_TOKENS: '512',
  CAPTION_ENDPOINT_TYPE: 'joycaption_local',
  CAPTION_JOY_CAPTION_TYPE: 'Descriptive',
  CAPTION_JOY_CAPTION_LENGTH: 'any',
  CAPTION_JOY_LOW_VRAM: 'false',
  CAPTION_OPT_REFER_BY_NAME: 'false',
  CAPTION_OPT_EXCLUDE_UNCHANGEABLE: 'false',
  CAPTION_OPT_INCLUDE_LIGHTING: 'false',
  CAPTION_OPT_INCLUDE_CAMERA_ANGLE: 'false',
  CAPTION_OPT_INCLUDE_WATERMARK: 'false',
  CAPTION_OPT_INCLUDE_JPEG: 'false',
  CAPTION_OPT_INCLUDE_CAMERA_DETAILS: 'false',
  CAPTION_OPT_NO_SEXUAL: 'false',
  CAPTION_OPT_NO_REAL_PEOPLE: 'false',
  CAPTION_OPT_ARTISTIC_PERSPECTIVE: 'false',
};

export default function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isSettingsLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    apiClient
      .get('/api/settings')
      .then(res => res.data)
      .then(data => {
        const captionBackend =
          data.CAPTION_ENDPOINT_TYPE === 'joycaption'
            ? 'joycaption_local'
            : data.CAPTION_ENDPOINT_TYPE || 'joycaption_local';
        setSettings({
          HF_TOKEN: data.HF_TOKEN || '',
          TRAINING_FOLDER: data.TRAINING_FOLDER || '',
          DATASETS_FOLDER: data.DATASETS_FOLDER || '',
          CAPTION_BASE_URL: data.CAPTION_BASE_URL || '',
          CAPTION_API_KEY: data.CAPTION_API_KEY || '',
          CAPTION_MODEL:
            data.CAPTION_MODEL ||
            (captionBackend === 'joycaption_hf'
              ? 'fancyfeast/llama-joycaption-beta-one-hf-llava'
              : captionBackend === 'joycaption_local'
                ? '/root/alvan-custom/joy-captioner'
                : ''),
          CAPTION_SYSTEM_PROMPT: data.CAPTION_SYSTEM_PROMPT || '',
          CAPTION_USER_PROMPT: data.CAPTION_USER_PROMPT || '',
          CAPTION_TRIGGER_WORD: data.CAPTION_TRIGGER_WORD || '',
          CAPTION_MAX_TOKENS: data.CAPTION_MAX_TOKENS || '512',
          CAPTION_ENDPOINT_TYPE: captionBackend,
          CAPTION_JOY_CAPTION_TYPE: data.CAPTION_JOY_CAPTION_TYPE || 'Descriptive',
          CAPTION_JOY_CAPTION_LENGTH: data.CAPTION_JOY_CAPTION_LENGTH || 'any',
          CAPTION_JOY_LOW_VRAM: data.CAPTION_JOY_LOW_VRAM || 'false',
          CAPTION_OPT_REFER_BY_NAME: data.CAPTION_OPT_REFER_BY_NAME || 'false',
          CAPTION_OPT_EXCLUDE_UNCHANGEABLE: data.CAPTION_OPT_EXCLUDE_UNCHANGEABLE || 'false',
          CAPTION_OPT_INCLUDE_LIGHTING: data.CAPTION_OPT_INCLUDE_LIGHTING || 'false',
          CAPTION_OPT_INCLUDE_CAMERA_ANGLE: data.CAPTION_OPT_INCLUDE_CAMERA_ANGLE || 'false',
          CAPTION_OPT_INCLUDE_WATERMARK: data.CAPTION_OPT_INCLUDE_WATERMARK || 'false',
          CAPTION_OPT_INCLUDE_JPEG: data.CAPTION_OPT_INCLUDE_JPEG || 'false',
          CAPTION_OPT_INCLUDE_CAMERA_DETAILS: data.CAPTION_OPT_INCLUDE_CAMERA_DETAILS || 'false',
          CAPTION_OPT_NO_SEXUAL: data.CAPTION_OPT_NO_SEXUAL || 'false',
          CAPTION_OPT_NO_REAL_PEOPLE: data.CAPTION_OPT_NO_REAL_PEOPLE || 'false',
          CAPTION_OPT_ARTISTIC_PERSPECTIVE: data.CAPTION_OPT_ARTISTIC_PERSPECTIVE || 'false',
        });
        setIsLoaded(true);
      })
      .catch(error => console.error('Error fetching settings:', error));
  }, []);

  return { settings, setSettings, isSettingsLoaded };
}
