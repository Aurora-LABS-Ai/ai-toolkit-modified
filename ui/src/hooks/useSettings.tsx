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
}

const defaultSettings: Settings = {
  HF_TOKEN: '',
  TRAINING_FOLDER: '',
  DATASETS_FOLDER: '',
  CAPTION_BASE_URL: '',
  CAPTION_API_KEY: '',
  CAPTION_MODEL: '',
  CAPTION_SYSTEM_PROMPT: '',
};

export default function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isSettingsLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    apiClient
      .get('/api/settings')
      .then(res => res.data)
      .then(data => {
        setSettings({
          HF_TOKEN: data.HF_TOKEN || '',
          TRAINING_FOLDER: data.TRAINING_FOLDER || '',
          DATASETS_FOLDER: data.DATASETS_FOLDER || '',
          CAPTION_BASE_URL: data.CAPTION_BASE_URL || '',
          CAPTION_API_KEY: data.CAPTION_API_KEY || '',
          CAPTION_MODEL: data.CAPTION_MODEL || '',
          CAPTION_SYSTEM_PROMPT: data.CAPTION_SYSTEM_PROMPT || '',
        });
        setIsLoaded(true);
      })
      .catch(error => console.error('Error fetching settings:', error));
  }, []);

  return { settings, setSettings, isSettingsLoaded };
}
