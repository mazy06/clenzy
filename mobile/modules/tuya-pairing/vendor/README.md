# Tuya Smart Life App SDK — fichiers natifs (vendored)

> Emplacement **persistant et versionné** pour le SDK App Tuya téléchargé depuis
> la console (App → Baitly → Get SDK → Build SDK → Download).
>
> ⚠️ **NE PAS** déposer le SDK dans `mobile/ios/` ou `mobile/android/` : ces dossiers
> sont **gitignorés** (`.gitignore` lignes 40‑41) et **régénérés** par `expo prebuild`
> (Continuous Native Generation) → tout y serait **perdu** au prochain prebuild.

## Où déposer

| Plateforme | Dossier | Contenu attendu (selon la version du SDK) |
|------------|---------|-------------------------------------------|
| iOS        | `vendor/ios/`     | Contenu du zip iOS : frameworks (`*.framework` / `*.xcframework`), le **fichier de sécurité lié à l'AppKey** (`ios_security` / `*.cer` / `.bundle`), et le snippet `Podfile` éventuel. |
| Android    | `vendor/android/` | Contenu du zip Android : `security-algorithm-*.aar` (lié à l'AppKey), tout `*.aar` local, et le snippet `build.gradle` fourni. |

> Les SDK Tuya récents tirent l'essentiel via **CocoaPods** (iOS) et **Maven** (Android) ;
> le seul fichier réellement local et critique est la **brique de sécurité liée à ton
> AppKey**. Dans le doute : **dézippe tout le téléchargement ici** (un sous-dossier par
> plateforme), je trie ensuite ce qui passe par le config plugin vs ce qui est référencé
> en local.

## Après le dépôt

Préviens-moi → je construis le module natif `TuyaPairing` (iOS + Android) + le
**config plugin Expo** qui câble ces fichiers dans les `ios/` / `android/` générés,
puis on enchaîne sur un **build EAS dev-client**.
