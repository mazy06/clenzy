import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { normalizeTheme, type WelcomeBookThemeId } from './welcomeBookThemes';

type Region = 'welcome' | 'essentials' | 'navigation' | 'neighbourhood' | 'experiences' | 'services' | 'journey' | 'review' | 'footer';

/** Visual order is also DOM order, so keyboard and screen-reader navigation stay consistent. */
const HOME_ORDERS: Record<WelcomeBookThemeId, Region[]> = {
  atelier: ['welcome', 'navigation', 'essentials', 'neighbourhood', 'experiences', 'services', 'journey', 'review', 'footer'],
  noir: ['welcome', 'essentials', 'services', 'navigation', 'neighbourhood', 'experiences', 'journey', 'review', 'footer'],
  jardin: ['welcome', 'neighbourhood', 'navigation', 'essentials', 'experiences', 'services', 'journey', 'review', 'footer'],
  azur: ['essentials', 'navigation', 'neighbourhood', 'experiences', 'services', 'welcome', 'journey', 'review', 'footer'],
  corail: ['navigation', 'experiences', 'essentials', 'welcome', 'neighbourhood', 'services', 'journey', 'review', 'footer'],
  brume: ['navigation', 'welcome', 'essentials', 'neighbourhood', 'services', 'experiences', 'journey', 'review', 'footer'],
  minuit: ['essentials', 'services', 'neighbourhood', 'navigation', 'welcome', 'experiences', 'journey', 'review', 'footer'],
};

export function BaitlyBookHomeLayout({ theme, structure, children }: { theme: string; structure?: string; children: ReactNode }) {
  const order = [...HOME_ORDERS[normalizeTheme(theme)]];
  const priorities: Region[] = structure === 'cityguide' ? ['neighbourhood', 'experiences']
    : structure === 'longue' ? ['journey'] : structure === 'conciergerie' ? ['journey', 'services'] : [];
  const regions = [...priorities, ...order.filter(region => !priorities.includes(region))];
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ 'data-book-region'?: Region; compact?: boolean }>[];
  const region = (item: typeof items[number]) => item.props['data-book-region'] ?? (item.props.compact ? 'neighbourhood' : 'footer');
  items.sort((a, b) => regions.indexOf(region(a)) - regions.indexOf(region(b)));
  return <div className="wb-home__content" data-information-layout={normalizeTheme(theme)}>{items}</div>;
}

type ArrivalRegion = 'times' | 'address' | 'code' | 'unlock' | 'photos' | 'checkin' | 'notes' | 'contact';
const ARRIVAL_ORDERS: Record<WelcomeBookThemeId, ArrivalRegion[]> = {
  atelier: ['address', 'times', 'code', 'unlock', 'photos', 'notes', 'checkin', 'contact'],
  noir: ['checkin', 'address', 'code', 'unlock', 'times', 'notes', 'photos', 'contact'],
  jardin: ['notes', 'address', 'photos', 'times', 'code', 'unlock', 'checkin', 'contact'],
  azur: ['address', 'times', 'photos', 'code', 'unlock', 'checkin', 'notes', 'contact'],
  corail: ['times', 'notes', 'photos', 'address', 'code', 'unlock', 'checkin', 'contact'],
  brume: ['address', 'code', 'unlock', 'times', 'notes', 'photos', 'checkin', 'contact'],
  minuit: ['code', 'unlock', 'checkin', 'times', 'address', 'contact', 'photos', 'notes'],
};

export function BaitlyBookArrivalLayout({ theme, children }: { theme: string; children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{
    className?: string; region?: ArrivalRegion; 'data-book-region'?: ArrivalRegion;
  }>[];
  const region = (item: typeof items[number]): ArrivalRegion => item.props.region ?? item.props['data-book-region']
    ?? (item.props.className?.includes('wb-arrival__times') ? 'times'
      : item.props.className?.includes('wb-arrival__address') ? 'address'
        : item.props.className?.includes('wb-arrival__code') ? 'code' : 'notes');
  const order = ARRIVAL_ORDERS[normalizeTheme(theme)];
  items.sort((a, b) => order.indexOf(region(a)) - order.indexOf(region(b)));
  return <div className="wb-arrival">{items}</div>;
}
