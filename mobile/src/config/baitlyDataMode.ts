import { create } from 'zustand';
import { API_CONFIG } from './api';

export type BaitlyDataMode = 'demo' | 'real';
export function canUseBaitlyDemo() {
  if (!__DEV__) return false;
  try { return ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(new URL(API_CONFIG.BASE_URL).hostname); }
  catch { return false; }
}
const initialMode: BaitlyDataMode = canUseBaitlyDemo()
  && (process.env.EXPO_PUBLIC_BAITLY_DATA_MODE === 'demo'
    || (!process.env.EXPO_PUBLIC_BAITLY_DATA_MODE && process.env.EXPO_PUBLIC_BAITLY_DEMO_CATALOG === '1')) ? 'demo' : 'real';
export const useBaitlyDataMode = create<{ mode: BaitlyDataMode; setMode: (mode: BaitlyDataMode) => void }>(set => ({
  mode: initialMode,
  setMode: mode => set({ mode: canUseBaitlyDemo() ? mode : 'real' }),
}));
export const baitlyDataMode = () => canUseBaitlyDemo() ? useBaitlyDataMode.getState().mode : 'real';
