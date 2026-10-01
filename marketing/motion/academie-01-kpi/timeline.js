// Baitly Académie · Épisode 01 « Les 3 KPI de base » (version longue, ≈ 2 min 45). Un seul dossier,
// deux formats : le format vient de render.mjs (--format=9x16 | 16x9 → window.__FORMAT__) ou de l'URL
// (?format=16x9) en aperçu. Les plans SUIVENT la voix : align-vo.py (FOLLOW) recale `slots` (un plan
// par chapitre), les moments synchronisés et la durée dans `lang`. Les départs par défaut des
// répliques sont volontairement lointains : chaque réplique enchaîne sur la précédente après une
// respiration (0,5 s dans un chapitre, 0,85 s entre deux chapitres).
var ACADEMIE_WIDE = (window.__FORMAT__ || new URLSearchParams(location.search).get('format') || '9x16') === '16x9';
if (ACADEMIE_WIDE) document.documentElement.classList.add('f169');
window.TIMELINE = {
  width: ACADEMIE_WIDE ? 1920 : 1080, height: ACADEMIE_WIDE ? 1080 : 1920,
  duration: 170, fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 },
    { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 },
    { id: 'b9', start: 900 }, { id: 'b10', start: 900 }, { id: 'b11', start: 900 }, { id: 'b12', start: 900 },
    { id: 'b13', start: 900 }, { id: 'b14', start: 900 }, { id: 'b15', start: 900 }, { id: 'b16', start: 900 },
    { id: 'b17', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 occupation · 2 prix moyen · 3 RevPAR · 4 trois stratégies ·
  // 5 lire les trois ensemble · 6 à retenir. Moments : fXn / fXd formule (numérateur, dénominateur),
  // fXx / fXr exemple et résultat ; trap1 / blk / f1b nuits bloquées ; trap2 / fee1 / fee2 / wrong /
  // diff frais hors hébergement ; empty / id / why / unite RevPAR ; sA… sCr stratégies ; m1-m4 grille
  // de lecture ; season saisonnalité ; k1-k3 / app récapitulatif ; end écran de fin.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 11.63, "b3": 20.01, "b4": 27.46, "b5": 41.89, "b6": 49.11, "b7": 54.3, "b8": 66.68, "b9": 77.49, "b10": 84.87, "b11": 92.35, "b12": 102.6, "b13": 115.62, "b14": 127.19, "b15": 138.32, "b16": 142.92, "b17": 158.21}, "q2": 2.1, "three": 5.2, "f1n": 16.65, "f1d": 18.48, "f1x": 22.75, "f1r": 25.54, "trap1": 27.46, "blk": 34.18, "f1b": 39.14, "f2n": 45.91, "f2d": 47.99, "f2x": 50.77, "f2r": 52.57, "trap2": 54.3, "fee1": 57.63, "fee2": 59.95, "wrong": 63.51, "diff": 64.7, "f3n": 71.81, "f3d": 74.3, "empty": 76.26, "f3x": 77.49, "f3r": 80.28, "id": 82.3, "why": 85.1, "unite": 88.88, "sA": 94.41, "sAn": 96.36, "sAr": 99.71, "sB": 103.69, "sBn": 104.97, "sBr": 106.92, "sC": 108.99, "sCn": 110.82, "sCr": 112.28, "m1": 117.91, "m2": 123.12, "m3": 127.19, "m4": 134.75, "season": 139.35, "k1": 143.7, "k2": 146.39, "k3": 148.22, "app": 151.16, "end": 158.21, "slots": [[0.2, 11.43], [11.43, 41.69], [41.69, 66.48], [66.48, 92.15], [92.15, 115.42], [115.42, 142.72], [142.72, 158.21]], "duration": 163.1}},
};
