// Baitly Académie · Épisode 18 « Réservation directe ou plateforme ? » (≈ 2 min 25). Un seul dossier, deux formats : le format vient
// de render.mjs (--format=9x16 | 16x9 → window.__FORMAT__) ou de l'URL (?format=16x9) en aperçu.
// Les plans SUIVENT la voix : align-vo.py (FOLLOW) recale `slots` (un plan par chapitre), les moments
// synchronisés et la durée dans `lang`. Départs par défaut lointains : chaque réplique enchaîne sur la
// précédente après une respiration (0,5 s dans un chapitre, 0,85 s entre deux chapitres).
var ACADEMIE_WIDE = (window.__FORMAT__ || new URLSearchParams(location.search).get('format') || '9x16') === '16x9';
if (ACADEMIE_WIDE) document.documentElement.classList.add('f169');
window.TIMELINE = {
  width: ACADEMIE_WIDE ? 1920 : 1080, height: ACADEMIE_WIDE ? 1080 : 1920,
  duration: 150, fps: 30,
  voiceover: [
    { id: 'b1', start: 0.4 }, { id: 'b2', start: 900 }, { id: 'b3', start: 900 }, { id: 'b4', start: 900 },
    { id: 'b5', start: 900 }, { id: 'b6', start: 900 }, { id: 'b7', start: 900 }, { id: 'b8', start: 900 },
    { id: 'b9', start: 900 }, { id: 'b10', start: 900 }, { id: 'b11', start: 900 }, { id: 'b12', start: 900 },
    { id: 'b13', start: 900 },
  ],
  // Nappe musicale de la série, discrète sous la voix, éteinte en fondu sur l'écran de fin.
  audio: [{ path: '../academie-shared/audio/academie-nappe.wav', start: 0, gain: 0.16, fadeOut: 2.5 }],
  // Chapitres (slots) : 0 accroche · 1 le calcul · 2 ce que chacun coûte · 3 le seuil · 4 la stratégie ·
  // 5 l'équilibre · 6 à retenir. Moments : voir SYNC dans align-vo.py.
  sync: { slots: [[0, 1]] },
  lang: {"fr": {"starts": {"b1": 0.4, "b2": 12.84, "b3": 23.46, "b4": 34.26, "b5": 41.85, "b6": 52.92, "b7": 62.49, "b8": 77.14, "b9": 86.67, "b10": 93.96, "b11": 106.92, "b12": 115.57, "b13": 132.27}, "q2": 6.2, "calc": 10.89, "s660": 13.5, "com": 17.75, "com2": 19.22, "rest1": 21.39, "dir": 23.46, "fee": 27.05, "fee2": 29.77, "rest2": 31.39, "gap": 34.79, "year": 37.87, "y1800": 39.78, "why": 42.16, "o1": 46.39, "o2": 48.89, "o3": 50.07, "o4": 50.68, "d1": 55.14, "d2": 56.25, "d3": 57.54, "d4": 58.54, "q": 63.89, "th": 67.54, "ad": 70.54, "keep": 73.94, "st1": 78.55, "st2": 80.53, "st3": 84.35, "disc": 87.13, "g593": 90.34, "rule": 93.96, "ban": 95.18, "find": 101.95, "f1": 102.95, "f2": 104.28, "f3": 105.17, "bal": 107.39, "fill": 110.88, "grow": 111.58, "k1": 116.22, "k2": 118.35, "app": 122.5, "app2": 128.12, "end": 132.27, "slots": [[0.2, 12.64], [12.64, 41.65], [41.65, 62.29], [62.29, 76.94], [76.94, 106.72], [106.72, 115.37], [115.37, 132.27]], "duration": 137.1}},
};
