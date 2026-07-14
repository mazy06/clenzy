# Polices du template PDF Baitly

TTF statiques utilisées par `docs/baitly_pdf_theme.py` — **identiques à l'app**
(`client/index.html`) et au PDF ADR de référence.

| Fichier | Famille | Usage |
|---|---|---|
| `PlusJakartaSans_400Regular.ttf` … `_800ExtraBold.ttf` | **Plus Jakarta Sans** | corps + titres |
| `SpaceGrotesk_600SemiBold.ttf` (+ 500/700) | **Space Grotesk** | wordmark « baitly », display |

- **Licence** : SIL Open Font License 1.1 (OFL) — libre redistribution.
- **Source** : packages `@expo-google-fonts/plus-jakarta-sans` et
  `@expo-google-fonts/space-grotesk` (statiques Google Fonts).
- Si ces fichiers sont absents, le thème bascule automatiquement sur Avenir Next
  (macOS) puis Helvetica.
