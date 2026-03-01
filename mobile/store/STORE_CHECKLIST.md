# Clenzy Mobile - Checklist Soumission Stores

## Pre-requis communs

- [ ] Compte Expo/EAS configure (`eas.json` > `extra.eas.projectId`)
- [ ] Secret `EXPO_TOKEN` dans GitHub Actions
- [ ] Images finales : `icon.png` (1024x1024), `adaptive-icon.png`, `splash-icon.png`
- [ ] Screenshots pour chaque taille d'ecran
- [ ] Privacy policy accessible a l'URL https://clenzy.com/privacy
- [ ] Terms of service accessible a l'URL https://clenzy.com/terms
- [ ] Compte demo cree pour les reviewers (review@clenzy.com)

## Apple App Store (iOS)

### Requis App Store Connect
- [ ] Apple Developer Program (99$/an)
- [ ] App ID et certificats configures dans EAS (`eas.json` > `submit.production.ios`)
- [ ] Remplir `appleId`, `ascAppId`, `appleTeamId` dans `eas.json`
- [ ] App Store Connect : creer l'app, remplir metadata (description FR/EN)
- [ ] Screenshots iPhone 6.7" (5 minimum)
- [ ] Screenshots iPad 12.9" (si supportsTablet actif)

### Conformite Apple
- [x] Suppression compte in-app (`DeleteAccountScreen`)
- [x] Permissions camera/photo/localisation/FaceID declarees (`infoPlist`)
- [x] Deep links configures (`scheme: "clenzy"`)
- [x] Mode sombre supporte (`userInterfaceStyle: "automatic"`)
- [ ] Pas de webview deguisee (natif pur)
- [ ] Performance 60fps verifiee
- [ ] Review notes avec compte demo remplies

### Apple Privacy
- [ ] App Privacy declarations dans App Store Connect (cf. `data-safety.json`)
- [ ] Privacy Nutrition Labels configurees

## Google Play Store (Android)

### Requis Google Play Console
- [ ] Google Play Developer account (25$ une fois)
- [ ] Service Account Key pour `eas submit` (fichier JSON)
- [ ] Remplir `serviceAccountKeyPath` dans `eas.json`
- [ ] Google Play Console : creer l'app, remplir store listing

### Conformite Google
- [x] Permissions declarees dans `app.json` > `android.permissions`
- [x] Adaptive icon configuree
- [x] Edge-to-edge supporte
- [ ] Data Safety form rempli (cf. `data-safety.json`)
- [ ] Content rating questionnaire complete
- [ ] Target API level >= 34

### Distribution
- [ ] Premier build : track `internal` (testing interne)
- [ ] Valide en internal → promouvoir en `closed testing`
- [ ] Valide en closed → promouvoir en `production`

## Commandes EAS

```bash
# Build development (testing local)
eas build --profile development --platform all

# Build preview (testing interne)
eas build --profile preview --platform all

# Build production
eas build --profile production --platform all

# Soumission stores
eas submit --platform ios --profile production
eas submit --platform android --profile production

# OTA update (patches JS sans re-soumission)
eas update --branch production --message "v1.0.1 hotfix"
```

## Post-lancement

- [ ] Monitoring crashes (Sentry ou EAS Insights)
- [ ] Analytics (EAS Insights ou Firebase Analytics)
- [ ] Processus OTA updates pour patches rapides
- [ ] Calendrier de releases regulieres
