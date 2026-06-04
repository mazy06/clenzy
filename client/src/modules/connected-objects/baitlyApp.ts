/**
 * Configuration de l'app mobile de marque « Baitly » (Tuya OEM App) — modèle C d'onboarding
 * des objets connectés.
 *
 * Rappel architecture : l'appairage physique d'un appareil neuf exige une étape LOCALE
 * (Wi-Fi/BLE à proximité) impossible depuis le serveur. L'hôte appaire donc son objet dans
 * l'app Baitly (qui dépose l'appareil sur le compte/projet plateforme), puis le PMS le
 * DÉCOUVRE et le pilote via l'API cloud. Le PMS reste le cockpit ; l'app ne sert qu'à
 * l'appairage initial.
 *
 * TODO (quand l'OEM App est créée/publiée — console Tuya → App → OEM App) :
 *   1. basculer `available` à true
 *   2. renseigner `pairingDeepLink`, `iosStoreUrl`, `androidStoreUrl`
 */
export const BAITLY_APP = {
  /** L'app de marque est-elle publiée ? Tant que false, le guidage affiche « bientôt disponible ». */
  available: false,
  /** Nom affiché. */
  name: 'Baitly',
  /** Deep-link ouvrant l'app (idéalement sur l'écran d'appairage). Ex: 'baitlyapp://pair'. */
  pairingDeepLink: '',
  /** Lien App Store (fallback si l'app n'est pas installée). */
  iosStoreUrl: '',
  /** Lien Play Store (fallback si l'app n'est pas installée). */
  androidStoreUrl: '',
};
