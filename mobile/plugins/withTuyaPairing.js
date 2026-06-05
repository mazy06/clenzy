const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Config plugin Expo pour le module natif d'appairage Tuya (modules/tuya-pairing).
//
// Cote iOS, le SDK Tuya vient de CocoaPods (specs Tuya) + une brique de securite LOCALE
// per-AppKey (`ThingSmartCryption`, dossier ios_core_sdk). Ce plugin injecte dans le Podfile :
//   1. les `source` des repos de specs Tuya (sinon `pod ThingSmartHomeKit` est introuvable),
//   2. l'override `pod 'ThingSmartCryption', :path => ...` vers la brique locale committee.
//
// Cote Android, le repo Maven Tuya + les permissions sont gERES dans app.json
// (expo-build-properties.android.extraMavenRepos + android.permissions) — pas besoin de plugin.
// ─────────────────────────────────────────────────────────────────────────────

const TUYA_PODFILE_SOURCES = [
  "source 'https://github.com/tuya/tuya-pod-specs.git'",
  "source 'https://github.com/TuyaInc/TuyaPublicSpecs.git'",
  "source 'https://cdn.cocoapods.org/'",
].join('\n');

// Chemin du ThingSmartCryption local (per-AppKey), relatif au Podfile (mobile/ios/Podfile).
const CRYPTION_POD_LINE =
  "  pod 'ThingSmartCryption', :path => '../modules/tuya-pairing/ios/ios_core_sdk'";

function withTuyaPodfile(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // 1) Sources Tuya en tete du Podfile (idempotent).
      if (!contents.includes('tuya-pod-specs')) {
        contents = `${TUYA_PODFILE_SOURCES}\n\n${contents}`;
      }

      // 2) Override local ThingSmartCryption dans le target (apres use_expo_modules!).
      if (!contents.includes("pod 'ThingSmartCryption'")) {
        if (contents.includes('use_expo_modules!')) {
          contents = contents.replace(
            /(use_expo_modules!.*\n)/,
            `$1${CRYPTION_POD_LINE}\n`,
          );
        } else {
          // Fallback : juste apres l'ouverture du premier target.
          contents = contents.replace(/(target\s+['"][^'"]+['"]\s+do\n)/, `$1${CRYPTION_POD_LINE}\n`);
        }
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
}

module.exports = function withTuyaPairing(config) {
  return withTuyaPodfile(config);
};
