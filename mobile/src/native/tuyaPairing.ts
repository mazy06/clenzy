import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Contrat du module natif d'appairage Tuya (modele C).
 *
 * L'appairage d'un objet neuf = le **device activator du SDK Tuya** (provisioning Wi-Fi/BLE local),
 * qui est NATIF (iOS ThingSmart / Android TuyaHomeSdk). Ce fichier expose l'interface TS + un
 * fallback : tant que le module natif `TuyaPairing` n'est pas inclus dans le build dev-client/EAS
 * (cf. `modules/tuya-pairing` + config plugin), {@link isTuyaPairingAvailable} vaut false et les
 * appels levent une erreur explicite — l'UI bascule alors sur un message "build natif requis".
 *
 * TODO (point 1 — natif) : implementer le module `TuyaPairing` (iOS + Android) encapsulant le SDK
 * Tuya : init(appKey, appSecret), login compte app, getActivatorToken, activator EZ/AP/BLE.
 */

export type PairingMode = 'EZ' | 'AP' | 'BLE';

export interface PairedDevice {
  devId: string;
  name: string;
  productId?: string;
  category?: string;
}

export interface StartPairingParams {
  mode: PairingMode;
  /** SSID du Wi-Fi 2.4 GHz du logement (EZ/AP). */
  ssid: string;
  /** Mot de passe Wi-Fi. */
  password: string;
  /** Token d'appairage (getPairingToken). */
  token: string;
  timeoutSec?: number;
}

interface TuyaPairingNativeModule {
  /** Initialise le SDK Tuya avec l'AppKey/AppSecret de l'App SDK. */
  init(appKey: string, appSecret: string): Promise<void>;
  /** Connecte le SDK au compte app Tuya de l'hote (fourni par le PMS). */
  loginAppAccount(countryCode: string, username: string, password: string): Promise<{ uid: string }>;
  /** Recupere un token d'appairage aupres du cloud Tuya pour le compte connecte. */
  getPairingToken(): Promise<string>;
  /** Lance l'activator (provisioning local) et resout avec le(s) device(s) appaire(s). */
  startPairing(params: StartPairingParams): Promise<PairedDevice[]>;
  /** Annule un appairage en cours. */
  stopPairing(): Promise<void>;
}

// Present uniquement dans un build natif (dev-client/EAS) incluant le module Tuya.
const nativeModule = requireOptionalNativeModule<TuyaPairingNativeModule>('TuyaPairing');

/** True si le module natif Tuya est present (build natif avec le SDK). */
export const isTuyaPairingAvailable = nativeModule != null;

function ensureNative(): TuyaPairingNativeModule {
  if (!nativeModule) {
    throw new Error(
      "Module natif Tuya indisponible : un build dev-client/EAS incluant le module natif " +
        "« TuyaPairing » (SDK Tuya) est requis. Voir modules/tuya-pairing + le config plugin.",
    );
  }
  return nativeModule;
}

/** Facade typee de l'appairage Tuya (delegue au module natif, sinon leve une erreur explicite). */
export const TuyaPairing = {
  isAvailable: isTuyaPairingAvailable,
  init: (appKey: string, appSecret: string) => ensureNative().init(appKey, appSecret),
  loginAppAccount: (countryCode: string, username: string, password: string) =>
    ensureNative().loginAppAccount(countryCode, username, password),
  getPairingToken: () => ensureNative().getPairingToken(),
  startPairing: (params: StartPairingParams) => ensureNative().startPairing(params),
  stopPairing: () => ensureNative().stopPairing(),
};
