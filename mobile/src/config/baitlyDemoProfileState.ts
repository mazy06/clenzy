import { create } from 'zustand';
import { baitlyDataMode, canUseBaitlyDemo } from './baitlyDataMode';

export type BaitlyDemoProfileKey = 'concierge' | 'owner' | 'cleaning' | 'maintenance' | 'laundry' | 'exterior';
/** Ephemeral preview state, independent of authenticated credentials. */
export const useBaitlyDemoProfile = create<{ key: BaitlyDemoProfileKey | null; select: (key: BaitlyDemoProfileKey | null) => void }>(set => ({
  key: null,
  select: key => set({ key: canUseBaitlyDemo() ? key : null }),
}));
export function isBaitlyProfilePreview() {
  return baitlyDataMode() === 'demo' && useBaitlyDemoProfile.getState().key !== null;
}
