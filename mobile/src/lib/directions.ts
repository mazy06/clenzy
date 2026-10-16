import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import i18n from '@/i18n/config';

/**
 * Guidage vers l'application GPS choisie par l'utilisateur (Plans, Google Maps,
 * Waze) au lieu d'imposer Google Maps. Même logique que le web
 * (`client/src/utils/directions.ts`) : les coordonnées priment sur l'adresse.
 */
export interface DirectionsTarget {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

interface DirectionsApp {
  label: string;
  url: string;
}

export function directionsApps(target: DirectionsTarget): DirectionsApp[] {
  const { latitude, longitude } = target;
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
  const address = target.address?.trim();
  if (!hasCoords && !address) return [];
  const point = hasCoords ? `${latitude},${longitude}` : encodeURIComponent(address as string);
  return [
    { label: i18n.t('directions.appleMaps', 'Plans'), url: `https://maps.apple.com/?daddr=${point}` },
    { label: 'Google Maps', url: `https://www.google.com/maps/dir/?api=1&destination=${point}` },
    { label: 'Waze', url: hasCoords ? `https://waze.com/ul?ll=${point}&navigate=yes` : `https://waze.com/ul?q=${point}&navigate=yes` },
  ];
}

/** Propose les applications GPS dans une feuille d'actions native, puis ouvre celle choisie. */
export function openDirections(target: DirectionsTarget): void {
  const apps = directionsApps(target);
  if (apps.length === 0) return;
  const title = i18n.t('directions.title', 'Itinéraire avec');
  const cancel = i18n.t('common.cancel', 'Annuler');
  const open = (app: DirectionsApp) => void Linking.openURL(app.url);

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [cancel, ...apps.map((app) => app.label)], cancelButtonIndex: 0 },
      (index) => {
        if (index > 0) open(apps[index - 1]);
      },
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...apps.map((app) => ({ text: app.label, onPress: () => open(app) })),
    { text: cancel, style: 'cancel' as const },
  ]);
}
