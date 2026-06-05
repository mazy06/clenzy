// Module local Expo « tuya-pairing » : implementation native de l'appairage Tuya (modele C).
//
// Le module natif est enregistre sous le nom « TuyaPairing » (cf. expo-module.config.json +
// ios/TuyaPairingModule.swift / android/.../TuyaPairingModule.kt). L'app y accede via la facade
// typee `src/native/tuyaPairing.ts` (requireOptionalNativeModule('TuyaPairing')). Ce fichier
// re-exporte l'acces natif brut pour la completude de la structure du module local Expo.
import { requireOptionalNativeModule } from 'expo-modules-core';

export default requireOptionalNativeModule('TuyaPairing');
