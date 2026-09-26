import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  acquisitionSearch,
  readAcquisitionContext,
} from '../../src/services/publicAcquisitionContext';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import { SiteLanguageProvider } from './siteLanguage';

vi.mock('./siteLaunch', () => ({ useSiteLaunch: () => ({ paused: true }) }));
afterEach(() => cleanup());
describe('Commercial context', () => {
  it('keeps commercial choices without propagating personal data or tokens', () => {
    const context = readAcquisitionContext(
      '?plan=pro&market=SA&properties=12&email=private@example.test&token=secret',
    );
    expect(context).toEqual({ plan: 'pro', market: 'SA', properties: 12 });
    expect(acquisitionSearch(context, 'ar')).toBe(
      '?lang=ar&plan=pro&market=SA&properties=12',
    );
  });
  it.each([
    '?plan=unknown&market=XX&properties=-1',
    '?properties=2.5',
    '?properties=100001',
    '?properties=Infinity',
  ])('ignores invalid query values: %s', (search) => {
    expect(readAcquisitionContext(search)).toEqual({});
  });
  it('retains the selected offer through the pre-launch redirect', () => {
    window.history.replaceState({}, '', '/?lang=fr');
    render(
      <MemoryRouter>
        <SiteLanguageProvider>
          <SiteAcquisitionLink to="/demo?plan=essential&market=EU&properties=8&token=secret">
            Demo
          </SiteAcquisitionLink>
        </SiteLanguageProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/bientot-disponible?lang=fr&plan=essential&market=EU&properties=8',
    );
  });
});
