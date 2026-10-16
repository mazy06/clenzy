import { describe, expect, it } from 'vitest';
import { identifyDeviceQr, onboardingModels } from './deviceOnboardingCatalog';

describe('device QR hints are inert, bounded and never claims', () => {
  it('recognizes only the documented Tuya short-link host', () => {
    expect(identifyDeviceQr('https://m.smart321.com/test-device')).toBe('tuya');
    for (const value of ['http://m.smart321.com/device', 'https://m.smart321.com.evil.test/device',
      'https://evil.test/m.smart321.com/device', 'https://m.smart321.com@evil.test/device',
      'https://user:pass@m.smart321.com/device', 'https://m.smart321.com:8080/device',
      'https://127.0.0.1/device', 'https://192.168.1.1/device', 'javascript:alert(1)',
      'https://m.smart321.com/', 'x'.repeat(2049)]) expect(identifyDeviceQr(value)).toBe('unknown');
  });

  it('separates Matter and Wi-Fi setup from manufacturer authorization', () => {
    expect(identifyDeviceQr('MT:Y.K9042C00KA0648G00')).toBe('matter');
    expect(identifyDeviceQr('WIFI:T:WPA;S:test;P:test-only;;')).toBe('wifi');
    expect(identifyDeviceQr('b7d5efb8-2a94-4a78-b782-99d8ad2b3284')).toBe('unknown');
  });

  it('does not infer Wi-Fi or hub independence from a brand alone', () => {
    expect(onboardingModels('noise', 'MINUT').map(model => model.label)).toEqual(['M3', 'M2']);
    expect(onboardingModels('noise', 'TUYA')).toEqual([]);
    expect(onboardingModels('motion', 'MINUT')).toEqual([]);
    expect(onboardingModels('lock', 'NUKI').some(model => model.label === 'Smart Lock 3.0')).toBe(false);
  });
});
