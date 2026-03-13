import type { ViewSettings } from './book';

export interface SystemSettings {
  globalViewSettings: Partial<ViewSettings>;
  lastUpdated: number;
  preferredLocale?: string;
}
