import React from 'react';
import {
  Home,
  EventNote,
  Build,
  Contacts,
  Mail,
  Description,
  Handshake,
  Payment,
  Euro,
  Hub,
  Public,
  StorefrontOutlined,
  Sync,
  Speed,
  CurrencyExchange,
  Storage,
  LocalOffer,
  Dashboard,
  Assessment,
  Settings,
  Security,
  AdminPanelSettings,
  CalendarViewWeek,
  Bolt,
} from '../icons';

/**
 * Icônes d'identité de navigation Baitly — source unique partagée par le
 * PageHeader (pastille du titre), le fil d'Ariane et le switcher de hub.
 *
 * Les clés sont les identifiants de hub / routes canoniques de
 * `config/navigationHubs.ts` : ce sont des identifiants FONCTIONNELS
 * (routes), jamais du texte affiché.
 */

/** Icône d'identité du hub (clé = hub.id). */
export const HUB_ICON: Record<string, React.ReactNode> = {
  exploitation: <Home />,
  contacts: <Contacts />,
  documents: <Description />,
  finances: <Euro />,
  distribution: <Hub />,
  'platform-tools': <Build />,
};

/** Icône par écran (onglet de hub ou écran autonome), clé = route canonique. */
export const SCREEN_ICON: Record<string, React.ReactNode> = {
  '/properties': <Home />,
  '/reservations': <EventNote />,
  '/interventions': <Build />,
  '/contact': <Mail />,
  '/directory': <Contacts />,
  '/documents': <Description />,
  '/contracts': <Handshake />,
  '/billing': <Payment />,
  '/tarification': <Euro />,
  '/channels': <Hub />,
  '/booking-engine': <Public />,
  '/shop': <StorefrontOutlined />,
  '/admin/sync': <Sync />,
  '/admin/kpi': <Speed />,
  '/admin/exchange-rates': <CurrencyExchange />,
  '/admin/database': <Storage />,
  '/admin/promo-codes': <LocalOffer />,
  // Écrans autonomes
  '/planning': <CalendarViewWeek />,
  '/dashboard': <Dashboard />,
  '/reports': <Assessment />,
  '/settings': <Settings />,
  '/automation-rules': <Bolt />,
  '/permissions-test': <AdminPanelSettings />,
  '/admin/monitoring': <Security />,
};

/** Clone une icône lucide en lui imposant taille et épaisseur de trait. */
export function sizedIcon(node: React.ReactNode, size: number, strokeWidth = 1.85): React.ReactNode {
  return React.isValidElement(node)
    ? React.cloneElement(node as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
        size,
        strokeWidth,
      })
    : node;
}

/**
 * Icône de l'écran couvrant `pathname` — match sur le préfixe le PLUS LONG,
 * pour que `/properties/123/edit` hérite de l'icône de `/properties`.
 */
export function screenIconFor(pathname: string): React.ReactNode | undefined {
  const match = Object.keys(SCREEN_ICON)
    .filter((route) => pathname === route || pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? SCREEN_ICON[match] : undefined;
}
