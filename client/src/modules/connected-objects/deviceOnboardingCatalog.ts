import type { DeviceKind } from './types';

/** Documentation is evidence of a transport, never certification of a Baitly integration. */
export interface DeviceOnboardingModel {
  id: string;
  label: string;
  guide: 'minut' | 'nuki';
  remote: 'wifi-cloud';
  sourceUrl: string;
}

const MINUT_WIFI = 'https://support.minut.com/en/articles/2215928-wifi-and-connectivity';
const NUKI_REMOTE = 'https://docs.nuki.io/guide/overview/concepts/';

// Only explicitly documented models belong here. Tuya/Smart Life is an ecosystem,
// not a model or proof of Wi-Fi, noise data availability, or gateway independence.
const MODELS: Partial<Record<DeviceKind, Record<string, readonly DeviceOnboardingModel[]>>> = {
  noise: {
    MINUT: [
      { id: 'minut-m3', label: 'M3', guide: 'minut', remote: 'wifi-cloud', sourceUrl: MINUT_WIFI },
      { id: 'minut-m2', label: 'M2', guide: 'minut', remote: 'wifi-cloud', sourceUrl: MINUT_WIFI },
    ],
  },
  lock: {
    NUKI: [
      { id: 'nuki-ultra', label: 'Smart Lock Ultra', guide: 'nuki', remote: 'wifi-cloud', sourceUrl: NUKI_REMOTE },
      { id: 'nuki-pro-4', label: 'Smart Lock Pro (4th gen.)', guide: 'nuki', remote: 'wifi-cloud', sourceUrl: NUKI_REMOTE },
      { id: 'nuki-pro-5', label: 'Smart Lock Pro (5th gen.)', guide: 'nuki', remote: 'wifi-cloud', sourceUrl: NUKI_REMOTE },
      { id: 'nuki-pro-3', label: 'Smart Lock 3.0 Pro', guide: 'nuki', remote: 'wifi-cloud', sourceUrl: NUKI_REMOTE },
    ],
  },
};

export function onboardingModels(kind: DeviceKind, provider: string): readonly DeviceOnboardingModel[] {
  return MODELS[kind]?.[provider] ?? [];
}

export type DeviceQrHint = 'tuya' | 'matter' | 'wifi' | 'unknown';

/** Local classification only: never fetch a scanned URL, extract a claim, or trust ownership. */
export function identifyDeviceQr(raw: string): DeviceQrHint {
  const value = raw.trim();
  if (!value || value.length > 2048) return 'unknown';
  if (/^MT:[0-9A-Z.\-]+$/.test(value)) return 'matter';
  if (value.startsWith('WIFI:')) return 'wifi';
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port
      && url.hostname === 'm.smart321.com' && url.pathname.length > 1) return 'tuya';
  } catch { /* Unrecognized payloads stay inert. */ }
  return 'unknown';
}
