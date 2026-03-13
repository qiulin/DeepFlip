import { create } from 'zustand';
import type { SystemSettings } from '@/types/settings';
import type { ViewSettings } from '@/types/book';

const DEFAULT_GLOBAL_VIEW_SETTINGS: Partial<ViewSettings> = {
  theme: 'light',
  defaultFontSize: 18,
  lineHeight: 1.5,
  scrolled: false,
};

interface SettingsStore {
  settings: SystemSettings;
  setSettings: (settings: Partial<SystemSettings>) => void;
  updateGlobalViewSettings: (updates: Partial<ViewSettings>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {
    globalViewSettings: DEFAULT_GLOBAL_VIEW_SETTINGS,
    lastUpdated: Date.now(),
  },
  setSettings: (updates) =>
    set((state) => ({ settings: { ...state.settings, ...updates } })),
  updateGlobalViewSettings: (updates) =>
    set((state) => ({
      settings: {
        ...state.settings,
        globalViewSettings: { ...state.settings.globalViewSettings, ...updates },
      },
    })),
}));
