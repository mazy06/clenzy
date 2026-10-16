import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';

export const baitlyLight = {
  background: '#E8EEF3', surface: '#FBFCFD', muted: '#E1E9F0',
  ink: '#1B2A35', secondary: '#526674', border: '#D5DEE7',
  primary: '#1B2A35', onPrimary: '#FBFCFD',
  danger: '#93413F', dangerSoft: '#F5E7E7',
  warning: '#7A5320', warningSoft: '#F4EBDD',
  success: '#0C7166', successSoft: '#DDF1ED',
};
export const baitlyDark: typeof baitlyLight = {
  background: '#0A1120', surface: '#111B31', muted: '#16223A',
  ink: '#D7E1EE', secondary: '#8FA3BD', border: '#2A3A55',
  primary: '#E8EEF5', onPrimary: '#0A1120',
  danger: '#F2B7B5', dangerSoft: '#372632',
  warning: '#E0B483', warningSoft: '#332C2B',
  success: '#2DD4BF', successSoft: '#143234',
};
export function useBaitlyTheme() {
  const scheme = useColorScheme();
  const mode = useSettingsStore(s => s.themeMode);
  return (mode === 'system' ? scheme === 'dark' : mode === 'dark') ? baitlyDark : baitlyLight;
}
