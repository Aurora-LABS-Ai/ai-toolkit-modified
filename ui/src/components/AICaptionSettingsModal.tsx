'use client';

import React, { useEffect, useState } from 'react';
import { createGlobalState } from 'react-global-hooks';
import { Modal } from '@/components/Modal';
import { apiClient } from '@/utils/api';
import { Settings } from '@/hooks/useSettings';
import { AICaptionSettingsFields, applyCaptionDefaults } from '@/components/AICaptionSettingsFields';

type AICaptionSettingsModalState = {
  settings: Settings;
  onSave?: (settings: Settings) => void;
};

export const aiCaptionSettingsModalState = createGlobalState<AICaptionSettingsModalState | null>(null);

export const openAICaptionSettingsModal = (settings: Settings, onSave?: (settings: Settings) => void) => {
  aiCaptionSettingsModalState.set({ settings: applyCaptionDefaults(settings), onSave });
};

export const AICaptionSettingsModal: React.FC = () => {
  const [modalInfo, setModalInfo] = aiCaptionSettingsModalState.use();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const open = modalInfo !== null;

  useEffect(() => {
    if (modalInfo) {
      setSettings(applyCaptionDefaults(modalInfo.settings));
      setStatus('idle');
    }
  }, [modalInfo]);

  const handleClose = () => {
    setModalInfo(null);
    setSettings(null);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setStatus('saving');
    const nextSettings = applyCaptionDefaults(settings);
    try {
      await apiClient.post('/api/settings', nextSettings);
      modalInfo?.onSave?.(nextSettings);
      setStatus('success');
      handleClose();
    } catch (error) {
      console.error('Error saving AI caption settings:', error);
      setStatus('error');
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="AI Caption Settings" size="lg">
      {settings && (
        <form
          className="space-y-4 text-gray-200"
          onSubmit={e => {
            e.preventDefault();
            saveSettings();
          }}
        >
          <AICaptionSettingsFields
            settings={settings}
            setSettings={updater =>
              setSettings(prev => {
                if (!prev) return prev;
                return typeof updater === 'function' ? updater(prev) : updater;
              })
            }
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-md bg-gray-700 px-4 py-2 text-gray-200 hover:bg-gray-600"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
              disabled={status === 'saving'}
            >
              {status === 'saving' ? 'Saving...' : 'Save'}
            </button>
          </div>
          {status === 'error' && <p className="text-sm text-red-400">Failed to save settings.</p>}
        </form>
      )}
    </Modal>
  );
};
