import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import fr from '../../../public/locales/fr.json';
import en from '../../../public/locales/en.json';
import ar from '../../../public/locales/ar.json';
import { useMarketplacePresentation } from './useMarketplacePresentation';
import { summariseWeek } from './providerAvailability';

afterEach(cleanup);

describe('Marketplace language changes', () => {
  it('updates status, catalogue and availability labels without changing business values', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'fr', fallbackLng: 'fr', resources: {
      fr: { translation: fr }, en: { translation: en }, ar: { translation: ar },
    } });
    const wrapper = ({ children }: { children: ReactNode }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
    const { result } = renderHook(useMarketplacePresentation, { wrapper });
    const days = [3, 1];
    const category = { labelFr: 'Ménage', labelEn: 'Cleaning' };
    expect(result.current.catalogLabel(category)).toBe('Ménage');
    await act(() => i18n.changeLanguage('en'));
    expect(result.current.STATUS_LABELS.ACTIVE).toBe(en.marketplaceAdmin.status.ACTIVE);
    expect(result.current.catalogLabel(category)).toBe('Cleaning');
    expect(result.current.availabilitySummary(days)).toBe('Monday, Wednesday');
    expect(days).toEqual([3, 1]);
    expect(result.current.availabilitySummary([], true)).toBe(en.marketplaceAdmin.noAllowedSlots);
    expect(result.current.availabilitySummary([], false)).toBe(en.marketplaceAdmin.noConstraints);
    expect(result.current.formatOfferPrice(0, 'EUR', 'ON_QUOTE')).toBe(en.marketplaceAdmin.onQuote);
    await act(() => i18n.changeLanguage('ar'));
    expect(result.current.STATUS_LABELS.ACTIVE).toBe(ar.marketplaceAdmin.status.ACTIVE);
    expect(result.current.DAY_NAMES[0]).toBe('الاثنين');
    expect(result.current.catalogLabel(category)).toBe('Ménage');
  });

  it('translates consecutive days while preserving the declared time ranges', () => {
    const slots = [1, 2, 3].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '17:00' }));
    expect(summariseWeek(slots, 'en')).toEqual([{ days: 'Monday to Wednesday', hours: '09:00 – 17:00' }]);
    expect(summariseWeek(slots, 'ar')).toEqual([{ days: 'الاثنين إلى الأربعاء', hours: '09:00 – 17:00' }]);
    expect(summariseWeek(slots)).toEqual([{ days: 'Du lundi au mercredi', hours: '09:00 – 17:00' }]);
  });
});
