import type { WeekStart } from '../domain/dates';

export interface Settings {
  cookDecrements: boolean;
  weekStart: WeekStart;
  theme: 'System' | 'Dark' | 'Light';
  lastBackup: string | null;
  shopStale: boolean;
  shopGeneratedFor: string | null;
  persistAsked: boolean;
  onboarded: boolean;
}
export type SettingKey = keyof Settings;

export const SETTINGS_DEFAULTS: Settings = {
  cookDecrements: true,
  weekStart: 'Mon',
  theme: 'Dark',
  lastBackup: null,
  shopStale: false,
  shopGeneratedFor: null,
  persistAsked: false,
  onboarded: false,
};

/** Show the backup reminder after this many days (PRD §5.2). */
export const BACKUP_REMINDER_DAYS = 14;
