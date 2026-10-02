// Baitly Académie · Épisode 14 « Les 7 questions que tous les voyageurs posent » (≈ 2 min). Un seul dossier, deux formats : le format vient
// de render.mjs (--format=9x16 | 16x9 → window.__FORMAT__) ou de l'URL (?format=16x9) en aperçu.
// Les plans SUIVENT la voix : align-vo.py (FOLLOW) recale `slots` (un plan par chapitre), les moments
// synchronisés et la durée dans `lang`. Départs par défaut lointains : chaque réplique enchaîne sur la
// précédente après une respiration (0,5 s dans un chapitre, 0,85 s entre deux chapitres).
var ACADEMIE_WIDE = (window.__FORMAT__ || new URLSearchParams(location.search).get('format') || '9x16') === '16x9';
if (ACADEMIE_WIDE) document.documentElement.classList.add('f169');
window.TIMELINE = {
  width: ACADEMIE_WIDE ? 1920 : 1080, height: ACADEMIE_WIDE ? 1080 : 1920,
  duration: 175, fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 }, { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 }, { id: 'b9', start: 900 }, { id: 'b10', start: 900 }, { id: 'b11', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 ce que coûtent les questions · 2 les sept questions · 3 le bon moment · 4 mise en pratique · 5 à retenir.
  // Voix : Noé. Moments : SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 12.44, "b3": 21.36, "b4": 31.22, "b5": 38.53, "b6": 48.11, "b7": 62.92, "b8": 74.98, "b9": 86.18, "b10": 99.33, "b11": 116.85}, "wifi": 0.5, "seven": 7.1, "q2": 8.39, "cost": 12.44, "msg": 15.3, "rep": 16.31, "bad": 19.11, "night": 20.17, "calc": 21.36, "v20": 22.37, "v3": 23.64, "v5": 25.12, "v300": 26.55, "v5h": 27.67, "list": 31.22, "n1": 33.1, "n2": 34.32, "n3": 36.48, "n4": 39.5, "n5": 40.37, "n6": 43.75, "n7": 45.87, "trap1": 48.11, "nobody": 51.2, "short": 52.32, "exq": 57.03, "onep": 60.84, "moment": 62.92, "t1": 65.86, "t2": 69.59, "t3": 72.18, "code": 74.98, "week": 77.1, "early": 80.06, "dday": 82.92, "prat": 86.18, "m100": 90.37, "h140": 91.14, "rest": 93.53, "r1": 96.32, "r2": 96.82, "r3": 97.36, "k1": 99.93, "k2": 100.72, "k3": 102.74, "k4": 103.48, "app": 105.11, "lock": 110.63, "bot": 112.85, "end": 116.85, "slots": [[0.2, 12.24], [12.24, 31.02], [31.02, 62.72], [62.72, 85.98], [85.98, 99.13], [99.13, 116.85]], "duration": 121.7}},
};
