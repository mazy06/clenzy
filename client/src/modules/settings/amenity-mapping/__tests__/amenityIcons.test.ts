import { describe, it, expect } from 'vitest';
import { Wifi, Sparkles, WashingMachine } from 'lucide-react';
import {
  DEFAULT_AMENITY_ICONS,
  ICON_CATALOG,
  ICON_REGISTRY,
  resolveAmenityIcon,
  getCurrentIconName,
} from '../amenityIcons';

describe('DEFAULT_AMENITY_ICONS', () => {
  it('covers all 20 built-in amenity codes', () => {
    const builtInCodes = [
      'WIFI', 'TV', 'AIR_CONDITIONING', 'HEATING',
      'EQUIPPED_KITCHEN', 'DISHWASHER', 'MICROWAVE', 'OVEN',
      'WASHING_MACHINE', 'DRYER', 'IRON', 'HAIR_DRYER',
      'PARKING', 'POOL', 'JACUZZI', 'GARDEN_TERRACE', 'BARBECUE',
      'SAFE', 'BABY_BED', 'HIGH_CHAIR',
    ];
    for (const code of builtInCodes) {
      expect(DEFAULT_AMENITY_ICONS[code]).toBeDefined();
    }
  });

  it('every default icon name exists in the ICON_REGISTRY', () => {
    for (const [code, iconName] of Object.entries(DEFAULT_AMENITY_ICONS)) {
      expect(ICON_REGISTRY[iconName], `default for ${code} (${iconName}) must be in registry`).toBeDefined();
    }
  });
});

describe('ICON_CATALOG', () => {
  it('has at least 10 thematic groups', () => {
    expect(ICON_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  it('every icon in every group exists in the ICON_REGISTRY', () => {
    for (const group of ICON_CATALOG) {
      for (const iconName of group.icons) {
        expect(ICON_REGISTRY[iconName], `${group.id}/${iconName} must be in registry`).toBeDefined();
      }
    }
  });

  it('group ids are unique', () => {
    const ids = ICON_CATALOG.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('resolveAmenityIcon', () => {
  it('returns the default icon component for a known code without overrides', () => {
    const Icon = resolveAmenityIcon('WIFI');
    expect(Icon).toBe(Wifi);
  });

  it('returns the override icon when set', () => {
    const Icon = resolveAmenityIcon('WIFI', { WIFI: 'WashingMachine' });
    expect(Icon).toBe(WashingMachine);
  });

  it('returns Sparkles as fallback for an unknown code', () => {
    const Icon = resolveAmenityIcon('TOTALLY_MADE_UP_CODE');
    expect(Icon).toBe(Sparkles);
  });

  it('returns Sparkles when the override points to an unknown icon name', () => {
    const Icon = resolveAmenityIcon('WIFI', { WIFI: 'NotARealIcon' });
    expect(Icon).toBe(Sparkles);
  });

  it('default mapping wins when overrides object exists but has no entry for the code', () => {
    const Icon = resolveAmenityIcon('WIFI', { POOL: 'WavesLadder' });
    expect(Icon).toBe(Wifi);
  });
});

describe('getCurrentIconName', () => {
  it('returns the default icon name for a known code without overrides', () => {
    expect(getCurrentIconName('WIFI')).toBe('Wifi');
  });

  it('returns the override icon name when set', () => {
    expect(getCurrentIconName('WIFI', { WIFI: 'Router' })).toBe('Router');
  });

  it('returns "Sparkles" as fallback for an unknown code', () => {
    expect(getCurrentIconName('TOTALLY_MADE_UP_CODE')).toBe('Sparkles');
  });

  it('returns the override even if it does not exist in registry (semantic = "what the user picked")', () => {
    expect(getCurrentIconName('WIFI', { WIFI: 'NotARealIcon' })).toBe('NotARealIcon');
  });
});
